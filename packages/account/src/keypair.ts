import {
	DiffieHellman,
	ECPointOnCurveT,
	EncryptedMessageT,
	isPublicKey,
	MessageEncryption,
	PrivateKeyT,
	PublicKeyT,
	SignatureT,
	HDPathRadixT,
	HDMasterSeedT,
	HDNodeT,
} from '@radixdlt/crypto'
import { map, mergeMap } from 'rxjs/operators'
import { Observable, of } from 'rxjs'
import { toObservable } from '@radixdlt/util'
import {
	SigningKeyDecryptionInput,
	SigningKeyEncryptionInput,
	SigningKeyTypeHDT,
	SigningKeyTypeIdentifier,
	SigningKeyTypeNonHDT,
	SigningKeyTypeT,
	HDSigningKeyTypeIdentifier,
	PrivateKeyToSigningKeyInput,
} from './_types'
import { okAsync, ResultAsync } from 'neverthrow'
import { Option } from 'prelude-ts'
import { HardwareSigningKeyT } from '@radixdlt/hardware-wallet'
import { BuiltTransactionReadyToSign } from '@radixdlt/primitives'

export type SigningKeyT = ReturnType<typeof fromPrivateKey>

const makeSigningKeyTypeHD = (
	input: Readonly<{
		hdPath: HDPathRadixT
		hdSigningKeyType: HDSigningKeyTypeIdentifier
	}>,
): SigningKeyTypeHDT => {
	const { hdPath, hdSigningKeyType } = input
	const isHardwareSigningKey =
		hdSigningKeyType === HDSigningKeyTypeIdentifier.HARDWARE_OR_REMOTE
	const uniqueKey = `${isHardwareSigningKey ? 'Hardware' : 'Local'
		}_HD_signingKey_at_path_${hdPath.toString()}`
	return {
		typeIdentifier: SigningKeyTypeIdentifier.HD_SIGNING_KEY,
		hdSigningKeyType,
		hdPath,
		uniqueKey,
		isHDSigningKey: true,
		isHardwareSigningKey,
	}
}

const makeSigningKeyTypeNonHD = (
	input: Readonly<{
		publicKey: PublicKeyT
		name?: string
	}>,
): SigningKeyTypeNonHDT => {
	const named = Option.of(input.name)
		.map(n => `named_${n}`)
		.getOrElse('')
	const uniqueKey = `Non_hd_${named}pubKey${input.publicKey.toString(true)}`
	return {
		typeIdentifier: SigningKeyTypeIdentifier.NON_HD_SIGNING_KEY,
		uniqueKey,
		isHDSigningKey: false,
		isHardwareSigningKey: false,
		name: input.name,
	}
}

type Decrypt = (input: SigningKeyDecryptionInput) => Observable<string>
type Encrypt = (
	input: SigningKeyEncryptionInput,
) => Observable<EncryptedMessageT>

const makeDecrypt = (diffieHellman: DiffieHellman): Decrypt => (
	input: SigningKeyDecryptionInput,
): Observable<string> =>
	toObservable(
		MessageEncryption.decrypt({
			...input,
			diffieHellmanPoint: (): ResultAsync<ECPointOnCurveT, Error> =>
				diffieHellman(input.publicKeyOfOtherParty),
		}).map((buf: Buffer) => buf.toString('utf-8')),
	)

const makeEncrypt = (diffieHellman: DiffieHellman): Encrypt => (
	input: SigningKeyEncryptionInput,
): Observable<EncryptedMessageT> =>
	toObservable(
		MessageEncryption.encrypt({
			plaintext: input.plaintext,
			diffieHellmanPoint: (): ResultAsync<ECPointOnCurveT, Error> =>
				diffieHellman(input.publicKeyOfOtherParty),
		}),
	)

const makeEncryptHW = (hardwareSigningKey: HardwareSigningKeyT): Encrypt => (
	input: SigningKeyEncryptionInput,
): Observable<EncryptedMessageT> =>
	hardwareSigningKey.keyExchange(input.publicKeyOfOtherParty, 'encrypt').pipe(
		mergeMap((dhPoint: ECPointOnCurveT) =>
			toObservable(
				MessageEncryption.encrypt({
					plaintext: input.plaintext,
					diffieHellmanPoint: () => okAsync(dhPoint),
				}),
			),
		),
	)

const makeDecryptHW = (hardwareSigningKey: HardwareSigningKeyT): Decrypt => (
	input: SigningKeyDecryptionInput,
): Observable<string> =>
	hardwareSigningKey.keyExchange(input.publicKeyOfOtherParty, 'decrypt').pipe(
		mergeMap((dhPoint: ECPointOnCurveT) =>
			toObservable(
				MessageEncryption.decrypt({
					encryptedMessage: input.encryptedMessage,
					diffieHellmanPoint: (): ResultAsync<
						ECPointOnCurveT,
						Error
					> => okAsync(dhPoint),
				}),
			),
		),
		map((b: Buffer) => b.toString('utf8')),
	)

const fromPrivateKey = (
	privateKey: PrivateKeyT,
	hdPath: HDPathRadixT
) => ({
	decrypt: makeDecrypt(privateKey.diffieHellman),
	encrypt: makeEncrypt(privateKey.diffieHellman),
	sign: privateKey.sign,
	hdPath,
	publicKey: privateKey.publicKey(),
	equals: (other: any): boolean =>
		privateKey.publicKey().equals(other.publicKey),
	__diffieHellman: privateKey.diffieHellman,
})

const fromPrivateKeyAtHDPath = (
	input: Readonly<{
		privateKey: PrivateKeyT
		hdPath: HDPathRadixT
	}>,
) => fromPrivateKey(input.privateKey, input.hdPath)


const fromHDPathWithHWSigningKey = (
	input: Readonly<{
		hdPath: HDPathRadixT
		hardwareSigningKey: HardwareSigningKeyT
	}>,
) => {
	const { hdPath, hardwareSigningKey } = input

	const type: SigningKeyTypeT = makeSigningKeyTypeHD({
		hdPath,
		hdSigningKeyType: HDSigningKeyTypeIdentifier.HARDWARE_OR_REMOTE,
	})

	const newSigningKey = {
		...type, // forward sugar for boolean signingKey type getters
		isLocalHDSigningKey: false, // hardware is not local
		publicKey: hardwareSigningKey.publicKey,
		hdPath,
		getPublicKeyDisplayOnlyAddress: (): Observable<PublicKeyT> =>
			hardwareSigningKey.getPublicKeyDisplayOnlyAddress(),
		sign: (
			tx: BuiltTransactionReadyToSign,
			nonXrdHRP?: string,
		): Observable<SignatureT> => hardwareSigningKey.sign(tx, nonXrdHRP),
		signHash: (hashesMessage: Buffer): Observable<SignatureT> =>
			hardwareSigningKey.signHash(hashesMessage),
		decrypt: makeDecryptHW(hardwareSigningKey),
		encrypt: makeEncryptHW(hardwareSigningKey),
		type,
		uniqueIdentifier: type.uniqueKey,
		toString: (): string => {
			throw new Error('Overridden below.')
		},
		equals: (other: SigningKeyT): boolean =>
			hardwareSigningKey.publicKey.equals(other.publicKey),
		__diffieHellman: (
			_publicKeyOfOtherParty: PublicKeyT,
		): ResultAsync<ECPointOnCurveT, Error> => {
			throw new Error('No Dh here, only used for testing.')
		},
	}

	return {
		...newSigningKey
	}
}

const byDerivingNodeAtPath = (
	input: Readonly<{
		hdPath: HDPathRadixT
		deriveNodeAtPath: () => HDNodeT
	}>,
) =>
	fromPrivateKeyAtHDPath({
		...input,
		privateKey: input.deriveNodeAtPath().privateKey,
	})

const fromHDPathWithHDMasterNode = (
	input: Readonly<{
		hdPath: HDPathRadixT
		hdMasterNode: HDNodeT
	}>,
) => {
	const hdNodeAtPath = input.hdMasterNode.derive(input.hdPath)
	return fromPrivateKeyAtHDPath({
		...input,
		privateKey: hdNodeAtPath.privateKey,
	})
}

const fromHDPathWithHDMasterSeed = (
	input: Readonly<{
		hdPath: HDPathRadixT
		hdMasterSeed: HDMasterSeedT
	}>,
) => {
	const hdMasterNode = input.hdMasterSeed.masterNode()
	return fromHDPathWithHDMasterNode({ ...input, hdMasterNode })
}

export const isSigningKey = (something: unknown): something is SigningKeyT => {
	const inspection = something as SigningKeyT
	return (
		inspection.publicKey !== undefined &&
		isPublicKey(inspection.publicKey) &&
		inspection.sign !== undefined &&
		inspection.encrypt !== undefined &&
		inspection.decrypt !== undefined
	)
}

export const SigningKey = {
	__unsafeFromPrivateKeyAtHDPath: fromPrivateKeyAtHDPath,
	fromPrivateKey,
	byDerivingNodeAtPath,
	fromHDPathWithHWSigningKey,
	fromHDPathWithHDMasterNode,
	fromHDPathWithHDMasterSeed,
}
