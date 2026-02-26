import gql from "graphql-tag";
import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Promotion {
  promotionType?: string;
  discountAmount?: number;
  startTime?: Date;
  endTime?: Date;
}

export interface Cart extends BaseModel {
  customerId?: string;
  sessionId?: string;

  productId: string;

  productName: string;

  thumbnail?: string;

  price: number;
  originalPrice?: number;
  promotion?: Promotion;

  quantity: number;

  isSelected: boolean;
  isValid: boolean;

  stockCheckedAt?: Date;
  priceCheckedAt?: Date;

  product?: any;
}

export interface AddToCartInput {
  sessionId?: string;
  productId: string;
  productName: string;
  thumbnail?: string;
  price: number;
  originalPrice?: number;
  promotion?: Promotion;
  quantity: number;
}

export class CartRepository extends CrudRepository<Cart> {
  apiName: string = "Cart";
  displayName: string = t("giỏ hàng");
  shortFragment: string = this.parseFragment(`
    id
    productId
    productName
    thumbnail
    price
    originalPrice
    quantity
    isSelected
    isValid
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt
    customerId
    sessionId
    productId
    productName
    thumbnail
    price
    originalPrice
    promotion {
      promotionType
      discountAmount
      startTime
      endTime
    }
    quantity
  
    isSelected
    isValid
    stockCheckedAt
    priceCheckedAt
  `);

  async getMyCart(): Promise<Cart[]> {
    const result = await this.apollo.query({
      query: gql`
        query {
          getMyCart {
            ${this.fullFragment}
          }
        }
      `,
      fetchPolicy: "network-only",
    });
    return result.data["getMyCart"] as Cart[];
  }

  async addToCart(data: AddToCartInput): Promise<Cart> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation($data: AddToCartInput!) {
          addToCart(data: $data) {
            ${this.fullFragment}
          }
        }
      `,
      variables: { data },
    });
    return result.data["addToCart"] as Cart;
  }

  async updateCartItem(id: string, quantity?: number, isSelected?: boolean): Promise<Cart> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation($id: ID!, $data: UpdateCartItemInput!) {
          updateCartItem(id: $id, data: $data) {
            ${this.fullFragment}
          }
        }
      `,
      variables: {
        id,
        data: { quantity, isSelected },
      },
    });
    return result.data["updateCartItem"] as Cart;
  }

  async removeCartItem(id: string): Promise<Cart> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation ($id: ID!) {
          removeCartItem(id: $id) {
            id
          }
        }
      `,
      variables: { id },
    });
    return result.data["removeCartItem"] as Cart;
  }

  async toggleCartItemSelection(id: string): Promise<Cart> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation($id: ID!) {
          toggleCartItemSelection(id: $id) {
            ${this.fullFragment}
          }
        }
      `,
      variables: { id },
    });
    return result.data["toggleCartItemSelection"] as Cart;
  }

  async syncCartFromSession(sessionId: string): Promise<Cart[]> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation($sessionId: String!) {
          syncCartFromSession(sessionId: $sessionId) {
            ${this.fullFragment}
          }
        }
      `,
      variables: { sessionId },
    });
    return result.data["syncCartFromSession"] as Cart[];
  }

  async clearCart(): Promise<any> {
    const result = await this.apollo.mutate({
      mutation: gql`
        mutation {
          clearCart
        }
      `,
    });
    return result.data["clearCart"];
  }
}

export const CartService = new CartRepository();
