import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetListData, QueryInput } from "../crud.repo";
export type PropertySelectOption = {
  key: string; // key option
  label: string; // Nhãn hiển thị
};

export interface Category extends BaseModel {
  name?: string;
  priority?: number;
  active?: boolean;
  description?: string;
  imgUrl?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
}
export class CategoryRepository extends CrudRepository<Category> {
  apiName: string = "Category";
  displayName: string = t("Ngành hàng");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    description: String
    priority: Int
    active: Boolean
    imgUrl: String
    parentId: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    description: String
    priority: Int
    active: Boolean
    imgUrl: String
    parentId: String
    parent {
      id: String
      name: String
    }
    children {
      id: String
      name: String
      priority: Int
      parentId: String
    }
     
  `);

  /** Lấy danh sách category dạng cây (menu sidebar): root rồi children, sắp theo priority */
  async getCategoryTree(): Promise<Category[]> {
    const res = await this.getAll({
      query: { limit: 0, order: { priority: 1, createdAt: 1 } },
      fragment: this.parseFragment(`
        id
        name
        imgUrl
        description
        priority
        active
        parentId
      `),
    });
    const list = (res.data || []) as Category[];
    return this.buildTree(list, null);
  }

  /** Cây category chỉ gồm item active (dùng cho sidebar) */
  async getActiveCategoryTree(): Promise<Category[]> {
    const tree = await this.getCategoryTree();
    return this.filterActiveTree(tree);
  }

  /** Lấy danh sách category active (phân trang), gọi API getAllCategoryActive */
  async getAllCategoryActive(
    options: {
      query?: QueryInput;
      fragment?: string;
      cache?: boolean;
      toast?: any;
    } = {}
  ): Promise<GetListData<Category>> {
    return this.getAll({
      ...options,
      apiName: "getAllCategoryActive",
      query: options.query ?? { limit: 10 },
      fragment: options.fragment ?? this.shortFragment,
      cache: options.cache ?? true,
      toast: options.toast,
    });
  }

  /** Cây category active cho sidebar (public): gọi getAllCategoryActive rồi build cây */
  async getActiveCategoryTreeForSidebar(): Promise<Category[]> {
    const res = await this.getAllCategoryActive({ query: { limit: 0 } });
    const list = (res.data || []) as Category[];
    return this.buildTree(list, null);
  }

  private filterActiveTree(nodes: Category[]): Category[] {
    return nodes
      .filter((c) => c.active !== false)
      .map((c) => ({
        ...c,
        children: c.children?.length ? this.filterActiveTree(c.children) : [],
      }));
  }

  private buildTree(items: Category[], parentId: string | null): Category[] {
    return items
      .filter((c) => (c.parentId || null) === parentId)
      .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
      .map((c) => ({
        ...c,
        children: this.buildTree(items, c.id),
      }));
  }
}

export const CategoryService = new CategoryRepository();
