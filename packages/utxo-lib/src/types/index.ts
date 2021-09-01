import * as validation from './validation';

export const types = validation;

export type StackElement = Buffer | number;
export type Stack = StackElement[];
