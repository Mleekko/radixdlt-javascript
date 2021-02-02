import { Address } from '@radixdlt/crypto'
import { PositiveAmount } from '@radixdlt/primitives'
import { ResourceIdentifier } from '@radixdlt/atom'

export enum UserActionType {
	TOKEN_TRANSFER = 'TokenTransfer',
	BURN_TOKENS = 'BurnTokens',
}

export type UserAction = Readonly<{
	actionType: UserActionType
	sender: Address
	uuid: string
}>

export type TokensActionBase = UserAction &
	Readonly<{
		amount: PositiveAmount
		tokenResourceIdentifier: ResourceIdentifier
	}>

export type TransferTokensAction = TokensActionBase &
	Readonly<{
		actionType: UserActionType.TOKEN_TRANSFER
		recipient: Address
		message?: string
	}>

export type BurnTokensAction = TokensActionBase &
	Readonly<{
		actionType: UserActionType.BURN_TOKENS
	}>

export type TokensActionBaseInput = Readonly<{
	amount: PositiveAmount
	resourceIdentifier: ResourceIdentifier
	uuid?: string
}>

export type TransferTokensActionInput = TokensActionBaseInput &
	Readonly<{
		to: Address
		from: Address
		message?: string
	}>

export type BurnTokensActionInput = TokensActionBaseInput &
	Readonly<{
		burner: Address
	}>
