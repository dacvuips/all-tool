import { Document } from "mongoose";

export type Doc<T> = Document & T;
