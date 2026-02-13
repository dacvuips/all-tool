import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { User, UserService } from "../../../../../lib/repo";
import { Field, Form, Input } from "../../../../shared/utilities/form";

interface Props extends ReactProps {
  user: User;
  setUser: (user: User) => any;
}
export function SettingUser({ user, setUser }: Props) {
  return (
    <>
      <SettingUserForm user={user} setUser={setUser} />
    </>
  );
}

function SettingUserForm({ setUser, ...props }: Props) {
  const { t } = useTranslation();

  const {
    user,
    // userPermission
  } = useAuth();
  const toast = useToast();
  const router = useRouter();
  return (
    <Form<User>
      grid
      defaultValues={props.user}
      onSubmit={async (data) => {
        await UserService.update({ id: props.user.id, data, toast }).then((res) =>
          setUser({ ...props.user, ...res })
        );
      }}
    >
      <Form.Title title={t("Thông tin cấu hình")} />
      <Field label={t("Số xử lý giao dịch")} name="process" cols={6}>
        <Input number />
      </Field>

      <Form.Footer
        submitProps={{
          disabled:
            user.id == router.query["id"] ||
            // !userPermission("EDIT_USER") ||
            props.user.role === "ADMIN",
        }}
      />
    </Form>
  );
}
