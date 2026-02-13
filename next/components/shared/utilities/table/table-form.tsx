import { cloneDeep } from "lodash-es";
import { useMemo } from "react";

import { useTranslation } from "react-i18next";
import { BaseModel } from "../../../../lib/repo/crud.repo";
import { FooterProps, Form, FormProps } from "../form";
import { useDataTable } from "./data-table";

interface PropsType extends FormProps {
  title?: string;
  hasFooter?: boolean;
  footerProps?: FooterProps;
  beforeSubmit?: (data: any, defaultValues: any) => any;
  transformDefaultValues?: (defaultValues: any) => any;
  afterSubmit?: (data: any, defaultValues: any, item: Partial<BaseModel>) => any;
}
export function TableForm({ title, hasFooter = true, footerProps = {}, ...props }: PropsType) {
  const { t } = useTranslation();
  const { itemName, formItem, setFormItem, saveItem, loadAll } = useDataTable();

  const onSubmit = async (data) => {
    try {
      let newData = { ...data };
      if (props.beforeSubmit) newData = await props.beforeSubmit(newData, defaultValues);
      const res = await saveItem(newData);
      if (props.afterSubmit) await props.afterSubmit({ ...data }, defaultValues, res);
      await loadAll();
    } catch (err) {
      console.error(t(err.message));
    }
  };

  const defaultValues = useMemo(
    () =>
      formItem
        ? cloneDeep(
            props.transformDefaultValues ? props.transformDefaultValues(formItem) : formItem
          )
        : null,
    [formItem]
  );

  return (
    <Form
      width={550}
      defaultValues={defaultValues}
      {...props}
      title={
        title ||
        `${formItem?.id ? t("Cập nhật") : t("Tạo")} ${t(itemName)} ${
          formItem?.id ? "" : t("mới")
        }`.trim()
      }
      dialog
      isOpen={!!defaultValues}
      onClose={() => setFormItem(null)}
      onSubmit={onSubmit}
    >
      {props.children}
      {hasFooter && <Form.Footer {...footerProps} />}
    </Form>
  );
}
