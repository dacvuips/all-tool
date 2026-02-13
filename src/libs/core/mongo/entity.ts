export type BaseEntity = {
  _id: string;
};

export type TimestampEntity = BaseEntity & {
  createdAt?: Date;
  updatedAt?: Date;
};
