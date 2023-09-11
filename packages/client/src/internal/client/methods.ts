import {
    ClientCore,
    Context,
    IClientHttpCore,
    LIVE_CONTRACTS,
    SupportedNetworks,
    SupportedNetworksArray
} from "../../client-common";
import { IClientMethods } from "../../interface/IClient";
import { Ledger, Ledger__factory, Token, Token__factory } from "dms-osx-lib";
import { UnsupportedNetworkError } from "dms-sdk-common";
import { Provider } from "@ethersproject/providers";
import { ContractUtils } from "../../utils/ContractUtils";
import {
    ExchangeMileageToTokenOption,
    ExchangeTokenToMileageOption,
    FetchPayOption,
    PayMileageOption,
    PayTokenOption
} from "../../interfaces";
import {
    InsufficientBalanceError,
    InvalidEmailParamError,
    MismatchApproveAddressError,
    NoHttpModuleError,
    UnregisteredEmailError
} from "../../utils/errors";
import { BigNumber, ContractTransaction, ethers } from "ethers";
import { checkEmail } from "../../utils";
import { LinkCollection, LinkCollection__factory } from "del-osx-lib";
import { Network } from "../../client-common/interfaces/network";

/**
 * Methods module the SDK Generic Client
 */
export class ClientMethods extends ClientCore implements IClientMethods, IClientHttpCore {
    private relayEndpoint: string | URL | undefined;

    constructor(context: Context) {
        super(context);
        if (context.relayEndpoint) {
            this.relayEndpoint = context.relayEndpoint;
        }
        Object.freeze(ClientMethods.prototype);
        Object.freeze(this);
    }

    /**
     * 마일리지의 잔고를 리턴한다
     * @param {string} email - 이메일 주소
     * @return {Promise<BigNumber>} 마일리지 잔고
     */
    public async getMileageBalances(email: string): Promise<BigNumber> {
        if (!checkEmail(email)) throw new InvalidEmailParamError();

        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const ledgerInstance: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const emailHash = ContractUtils.sha256String(email);

        return await ledgerInstance.mileageBalanceOf(emailHash);
    }

    /**
     * 토큰의 잔고를 리턴한다.
     * @param {string} email - 이메일
     * @return {Promise<BigNumber>} 토큰 잔고
     */
    public async getTokenBalances(email: string): Promise<BigNumber> {
        if (!checkEmail(email)) throw new InvalidEmailParamError();

        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const ledgerInstance: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const emailHash = ContractUtils.sha256String(email);

        return await ledgerInstance.tokenBalanceOf(emailHash);
    }

    /**
     * 마일리지 사용승인 하여 Relay 서버로 전송하기 위한 서명값을 생성한다.
     * @param purchaseId - 거래 아이디
     * @param amount - 거래금액
     * @param email - 사용자 이메일 주소
     * @param franchiseeId - 거래처 아이디
     * @return {Promise<PayMileageOption>}
     */
    public async getPayMileageOption(
        purchaseId: string,
        amount: BigNumber,
        email: string,
        franchiseeId: string
    ): Promise<PayMileageOption> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const nonce = await ledgerContract.nonceOf(emailToAddress);
        const signature = await ContractUtils.signPayment(signer, purchaseId, amount, emailHash, franchiseeId, nonce);

        const relayParam: FetchPayOption = {
            purchaseId,
            amount: amount.toString(),
            email: emailHash,
            franchiseeId,
            signer: signerAddress,
            signature
        };
        return Promise.resolve(relayParam);
    }

    /**
     * 토큰 사용승인 하여 Relay 서버로 전송하기 위한 서명값을 생성한다.
     * @param purchaseId - 거래 아이디
     * @param amount - 거래금액
     * @param email - 사용자 이메일 주소
     * @param franchiseeId - 거래처 아이디
     * @return {Promise<PayTokenOption>}
     */
    public async getPayTokenOption(
        purchaseId: string,
        amount: BigNumber,
        email: string,
        franchiseeId: string
    ): Promise<PayTokenOption> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const nonce = await ledgerContract.nonceOf(emailToAddress);
        const signature = await ContractUtils.signPayment(signer, purchaseId, amount, emailHash, franchiseeId, nonce);

        const relayParam: FetchPayOption = {
            purchaseId,
            amount: amount.toString(),
            email: emailHash,
            franchiseeId,
            signer: signerAddress,
            signature
        };
        return Promise.resolve(relayParam);
    }

    /**
     * 토큰을 마일리지로 전환 하기위한 서명값을 생성한다.
     * @param {string} email - 이메일주소
     * @param {number} amount - 거래금액
     * @return {Promise<ExchangeTokenToMileageOption>}
     */
    public async getTokenToMileageOption(email: string, amount: BigNumber): Promise<ExchangeTokenToMileageOption> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const nonce: BigNumber = await ledgerContract.nonceOf(emailToAddress);
        const signature: string = await ContractUtils.signExchange(signer, emailHash, amount, nonce);

        return {
            email: emailHash,
            amountToken: amount.toString(),
            signer: signerAddress,
            signature
        };
    }

    /**
     * 마일리지를 토큰으로 전환 하기위한 서명값을 생성한다.
     * @param {string} email - 이메일주소
     * @param {number} amount - 거래금액
     * @return {Promise<ExchangeMileageToTokenOption>}
     */
    public async getMileageToTokenOption(email: string, amount: BigNumber): Promise<ExchangeMileageToTokenOption> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const nonce: BigNumber = await ledgerContract.nonceOf(emailToAddress);
        const signature: string = await ContractUtils.signExchange(signer, emailHash, amount, nonce);

        return {
            email: emailHash,
            amountMileage: amount.toString(),
            signer: signerAddress,
            signature
        };
    }

    public async deposit(email: string, amount: BigNumber): Promise<ContractTransaction[]> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);
        const tokenContract: Token = Token__factory.connect(LIVE_CONTRACTS[networkName].Token, provider);

        const balance = await tokenContract.balanceOf(signerAddress);
        if (amount.gte(balance)) throw new InsufficientBalanceError();

        const actions = [];
        const allowanceBalance = await tokenContract.allowance(signerAddress, ledgerContract.address);
        if (allowanceBalance.lte(amount)) {
            const approveTx = await tokenContract.connect(signer).approve(ledgerContract.address, amount);
            actions.push(approveTx);
            await approveTx.wait();
        }
        const depositTx = await ledgerContract.connect(signer).deposit(amount);
        await depositTx.wait();
        actions.push(depositTx);
        return actions;
    }

    public async withdraw(email: string, amount: BigNumber): Promise<ContractTransaction> {
        const provider = this.web3.getProvider() as Provider;
        const network = await provider.getNetwork();
        const signer = this.web3.getConnectedSigner();

        const networkName = network.name as SupportedNetworks;
        if (!SupportedNetworksArray.includes(networkName)) {
            throw new UnsupportedNetworkError(networkName);
        }

        const emailHash = ContractUtils.sha256String(email);
        const linkContract: LinkCollection = LinkCollection__factory.connect(
            LIVE_CONTRACTS[networkName].LinkCollection,
            provider
        );

        const emailToAddress: string = await linkContract.toAddress(emailHash);
        if (emailToAddress === ethers.constants.AddressZero) throw new UnregisteredEmailError();

        const signerAddress: string = await signer.getAddress();
        if (emailToAddress !== signerAddress) throw new MismatchApproveAddressError();

        const ledgerContract: Ledger = Ledger__factory.connect(LIVE_CONTRACTS[networkName].Ledger, provider);

        const currentDepositAmount = await ledgerContract.tokenBalanceOf(emailHash);
        if (currentDepositAmount.lte(amount)) throw new InsufficientBalanceError();

        const tx = await ledgerContract.connect(signer).withdraw(amount);
        await tx.wait();
        return tx;
    }

    public async fetchPayMileage(param: FetchPayOption): Promise<any> {
        return Network.post(await this.getEndpoint("payMileage"), param);
    }

    public async fetchPayToken(param: FetchPayOption): Promise<any> {
        return Network.post(await this.getEndpoint("payToken"), param);
    }

    public async fetchExchangeMileageToToken(param: ExchangeMileageToTokenOption): Promise<any> {
        return Network.post(await this.getEndpoint("exchangeMileageToToken"), param);
    }

    public async fetchExchangeTokenToMileage(param: ExchangeTokenToMileageOption): Promise<any> {
        return Network.post(await this.getEndpoint("exchangeTokenToMileage"), param);
    }

    public async isRelayUp(): Promise<boolean> {
        try {
            const res = await Network.get(await this.getEndpoint("/"));
            return res === "OK";
        } catch {
            return false;
        }
    }

    public async getEndpoint(path: string): Promise<URL> {
        if (!path) throw Error("Not path");
        let endpoint;
        if (this.relayEndpoint) {
            endpoint = this.relayEndpoint;
        } else {
            const provider = this.web3.getProvider() as Provider;
            const network = await provider.getNetwork();
            const networkName = network.name as SupportedNetworks;
            if (!SupportedNetworksArray.includes(networkName)) {
                throw new UnsupportedNetworkError(networkName);
            }
            endpoint = LIVE_CONTRACTS[networkName].relayEndpoint;
        }

        if (!endpoint) throw new NoHttpModuleError();

        const newUrl = typeof endpoint === "string" ? new URL(endpoint) : endpoint;
        if (newUrl && !newUrl?.pathname.endsWith("/")) {
            newUrl.pathname += "/";
        }
        return new URL(path, newUrl);
    }
}
