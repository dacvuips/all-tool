import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { GoogleAuthProvider } from "firebase/auth";
import md5 from "md5";
import { useTranslation } from "react-i18next";
import { localStorageKey } from "../constants/constants";
import { SCOPES } from "../constants/scopes.const";
import { ClearCustomerToken, ClearUserToken } from "../graphql/auth.link";
import { firebase } from "../helpers/firebase";
import { useNetworkMonitor } from "../hooks/useNetwork";

import { User, UserService } from "../repo/general/user.repo";

import { Customer, CustomerService } from "../repo/customer/customer.repo";
import { UserRoleEnum } from "../repo/types";
import { useToast } from "./toast-provider";
export const AuthContext = createContext<
  Partial<{
    user: User;
    customer: Customer;
    resetPasswordFirebaseEmail: (email: string) => Promise<any>;
    confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<any>;
    checkExpiredActionCode: (oobCode: string) => Promise<any>;
    loginFirebaseEmail: (email: string, password: string) => Promise<any>;
    loginCustomerByPhone: (idToken: string) => Promise<any>;
    loginCustomerByPhoneAndPassword: (phone: string, password: string) => Promise<any>;
    customerLoginFirebaseEmail: (email: string, password: string) => Promise<any>;
    loginCustomerWithGoogle: () => void;
    logout: () => Promise<any>;
    updateUser: (data: User) => Promise<any>;
    updateUserPassword: (id: string, password: string) => Promise<any>;
    activeUser: (userId: string) => Promise<User>;
    setCustomer: (customer: Customer) => any;
    setUser: (user: User) => any;
    blockUser: (userId: string) => Promise<User>;
    redirectToAdminLogin: Function;
    redirectToAdmin: Function;
    redirectToPartnerLogin: Function;
    redirectToPartner: Function;
    redirectToShop: Function;
    logoutCustomer: () => Promise<any>;
    customerUpdateProfile: (data) => Promise<Customer>;
    loadShop: Function;
    loadCustomer: Function;
    loadUser: Function;
    loadShopStaff: Function;
    userExchangePassword: (email: string, oldPassword: string, newPassword: string) => Promise<any>;
    customerExchangePassword: ({
      oldPassword,
      newPassword,
    }: {
      oldPassword: string;
      newPassword: string;
    }) => Promise<any>;
    userPermission: (
      scope: keyof typeof SCOPES | (keyof typeof SCOPES)[] | string,
      raw?: boolean
    ) => boolean;
  }>
>({});

export const PRE_LOGIN_PATHNAME = "pre-login-pathname";
export const PRE_SHOP_LOGIN_PATHNAME = "pre-shop-login-pathname";

export function AuthProvider(props) {
  const { t } = useTranslation();
  const toast = useToast();
  useNetworkMonitor(); // handle trạng thái connect và disconnect của network
  // undefined = chưa authenticated, null = chưa đăng nhập
  const [user, setUser] = useState<User>(undefined);
  const [customer, setCustomer] = useState<Customer>(undefined);
  const router = useRouter();
  //authentication with firebase
  const getFirebaseErrorMsg = (err) => {
    switch (err.code) {
      case "auth/email-already-in-use":
        return t("Email đã được sử dụng.");
      case "auth/invalid-email":
        return t("Email không hợp lệ.");
      case "auth/operation-not-allowed":
        return t("Không thể thực hiện chức năng này.");
      case "auth/weak-password":
        return t("Mật khẩu yếu.");
      case "auth/user-not-found":
        return t("Không tìm thấy người dùng");
      case "auth/wrong-password":
        return t("Sai mật khẩu");
      case "auth/expired-action-code":
        return t("Link đã hết hạn hoặc đã được sử dụng");
      case "auth/invalid-action-code":
        return t("Link đã hết hạn hoặc đã được sử dụng");
      case "auth/internal-error":
        return t("Đã xảy ra lỗi");
      default:
        return err.message;
    }
  };
  // useEffect(() => {
  //   // const userToken = GetUserToken();
  //   if (mode !== "user") return;
  //   UserService.userGetMe()
  //     .then((res) => setUser(res))
  //     .catch((err) => {
  //       ClearUserToken();
  //       waitForFirebase();
  //     });
  //   // if (userToken) {
  //   //   const decodedToken = jwtDecoder<any>(userToken);
  //   //   if (decodedToken.exp && new Date().getTime() > decodedToken.exp * 1000) {
  //   //     waitForFirebase();
  //   //   } else {
  //   //     console.log("try current token login");
  //   //     UserService.userGetMe()
  //   //       .then((res) => setUser(res))
  //   //       .catch((err) => {
  //   //         ClearUserToken();
  //   //         waitForFirebase();
  //   //       });
  //   //   }
  //   // } else {
  //   //   waitForFirebase();
  //   // }
  // }, []);
  const mode: "user" | "shop" | "customer" = useMemo(() => {
    const pathname = router.pathname;
    if (
      pathname == "/admin" ||
      pathname == "/partner" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/partner/")
    ) {
      return "user";
    } else if (pathname == "/shop" || pathname.startsWith("/shop/")) {
      return "shop";
    } else {
      return "customer";
    }
  }, [router.pathname]);
  useEffect(() => {
    switch (mode) {
      case "user": {
        loadUser();
        break;
      }
      case "customer": {
        loadCustomer();
        break;
      }
    }
  }, [mode]);

  const loadUser = async () => {
    await UserService.userGetMe()
      .then((res) => {
        setUser(res || null);
      })
      .catch((err) => {
        router.pathname.startsWith("/admin")
          ? router.replace("/admin/login")
          : router.replace("/partner/login");
        ClearUserToken();
        // waitForFirebase();
      });
  };

  const getCustomerInfo = async () => {
    await CustomerService.customerGetInfo()
      .then((res) => {
        setCustomer(res.customer);
      })
      .catch(() => {
        setCustomer(null);
      });
  };

  const handleAccessCustomerFormShop = async () => {
    localStorage.removeItem(localStorageKey.accessRole);
    await CustomerService.accessCustomer()
      .then(async (res) => {
        await getCustomerInfo();
      })
      .catch(async () => {
        setCustomer(null);
      });
    return;
  };

  const loadCustomer = async () => {
    const hasAccessShop =
      JSON.parse(localStorage.getItem(localStorageKey.accessRole))?.role === UserRoleEnum.SHOP;

    if (hasAccessShop) {
      await handleAccessCustomerFormShop();
    }
    try {
      await getCustomerInfo();
    } catch (err) {
      ClearCustomerToken();
      setCustomer(null);
      // throw err.message;
    }
  };

  const updateUser = async (data: User) => {
    return await UserService.update({ id: user.id, data: data });
  };

  const resetPasswordFirebaseEmail = async (email: string) => {
    try {
      const _firebase = await firebase();
      let res = await _firebase.auth().sendPasswordResetEmail(email);

      return res;
    } catch (err) {
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const confirmPasswordReset = async (oobCode, newPassword) => {
    try {
      const _firebase = await firebase();
      let res = await _firebase.auth().confirmPasswordReset(oobCode, newPassword);

      return res;
    } catch (err) {
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const checkExpiredActionCode = async (oobCode) => {
    try {
      const _firebase = await firebase();
      let res = await _firebase.auth().checkActionCode(oobCode);

      return res;
    } catch (err) {
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const loginFirebaseEmail = async (email: string, password: string) => {
    try {
      const _firebase = await firebase();
      const userCredential = await _firebase.auth().signInWithEmailAndPassword(email, password);
      const { user, token } = await UserService.login(await userCredential.user.getIdToken());
      // SetUserToken(token);
      setUser(user);
    } catch (err) {
      console.error(err);
      ClearUserToken();
      setUser(undefined);
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const customerLoginFirebaseEmail = async (email: string, password: string) => {
    try {
      const _firebase = await firebase();

      const userCredential = await _firebase.auth().signInWithEmailAndPassword(email, password);

      await CustomerService.customerLoginWithEmail({
        accessToken: await userCredential.user.getIdToken(),
        pw: password,
      }).then(async (res) => {
        await CustomerService.clearStore();
        setCustomer(res.customer);
      });

      // setTimeout(() => {
      //   router.reload();
      // }, 300);
    } catch (err) {
      console.error(err);
      ClearCustomerToken();
      setCustomer(undefined);
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const userExchangePassword = async (userId: string, oldPassword: string, newPassword: string) => {
    // Lấy thông tin người dùng hiện tại
    const _firebase = await firebase();
    const user = await UserService.getOne({ id: userId, fragment: "email" });
    // Check User
    const userCredential = await _firebase
      .auth()
      .signInWithEmailAndPassword(user.email, oldPassword);
    // Xác thực thành công, giờ đổi mật khẩu mới
    const idToken = await userCredential.user.getIdToken();
    if (idToken) {
      await UserService.userChangePassword(idToken, newPassword)
        .then((res) => {
          // loadUser();
        })
        .catch((err) => {
          toast.error(t("Đổi mật khẩu thất bại, mật khẩu cũ không đúng hoặc"));
          console.log(err);
        });
    } else {
      toast.error(t("Tài khoản không đúng"));
    }
  };

  const customerExchangePassword = async ({
    oldPassword,
    newPassword,
  }: {
    oldPassword: string;
    newPassword: string;
  }) => {
    // Lấy thông tin người dùng hiện tại
    const customerEmail = await CustomerService.customerGetEmail();
    // Check Customer
    try {
      const _firebase = await firebase();
      const customerCredential = await _firebase
        .auth()
        .signInWithEmailAndPassword(customerEmail, oldPassword);

      // Xác thực thành công, giờ đổi mật khẩu mới
      const idToken = await customerCredential.user.getIdToken();

      if (idToken) {
        await CustomerService.customerChangePassword({ idToken, password: newPassword })
          .then((res) => {
            // loadUser();
          })
          .catch((err) => {
            toast.error(`${t("Đổi mật khẩu thất bại")}, ${err.message}`);
            console.log(err);
          });
      } else {
        toast.error(t("Tài khoản không đúng"));
      }
      return true;
    } catch (err) {
      throw new Error(getFirebaseErrorMsg(err));
    }
  };

  const loginCustomerByPhone = async (idToken: string) => {
    // let deviceId = localStorage.getItem("device-id");
    // if (!deviceId) {
    //   deviceId = uuidv4();
    //   localStorage.setItem("device-id", deviceId);
    // }
    // let deviceToken = "";
    // try {
    //   const messaging = firebase.messaging();
    //   deviceToken = await messaging.getToken({ vapidKey: VAPID_KEY });
    // } catch (err) {
    //   console.error(err);
    // }
    // try {
    //   let res = await GraphService.mutate({
    //     mutation: `
    //       loginGlobalCustomerByPhone(idToken: "${idToken}", deviceId: "${deviceId}", deviceToken: "${deviceToken}") {
    //         globalCustomer { ${GlobalCustomerService.fullFragment} } token
    //       }
    //     `,
    //   });
    //   SetGlobalCustomerToken(res.data.g0.token);
    //   setGlobalCustomer(res.data.g0.globalCustomer);
    // } catch (err) {
    //   ClearGlobalCustomerToken();
    //   setGlobalCustomer(null);
    //   throw err.message;
    // }
  };

  const loginCustomerByPhoneAndPassword = async (phone: string, password: string) => {
    try {
      await CustomerService.customerLogin(phone, md5(password)).then((res) => {
        // SetCustomerToken(res.accessToken);
        setCustomer(res.customer);
        setTimeout(() => {
          router.reload();
        }, 300);
      });
    } catch (err) {
      ClearCustomerToken();
      setCustomer(null);
      throw err.message;
    }
  };

  const loginCustomerWithGoogle = async () => {
    const provider = new GoogleAuthProvider();

    const _firebase = await firebase();

    await _firebase
      .auth()
      .signInWithPopup(provider)
      .then(async (result) => {
        const user = result.user.multiFactor.user;

        await CustomerService.customerLoginWithGoogle(user.accessToken).then(() => {
          router.reload();
        });
      })
      .catch((error) => {
        console.log(error);
        toast.error(error.message);
      });
  };

  const logout = async () => {
    const _firebase = await firebase();
    await _firebase.auth().signOut();
    await UserService.clearStore();
    await UserService.logout();
    ClearUserToken();
  };

  const logoutCustomer = async () => {
    ClearCustomerToken();
    setCustomer(null);
    await CustomerService.clearStore();
    await UserService.logout();
    router.replace("/");
  };

  const activeUser = async (userId) => {
    return UserService.activeUser(userId);
  };

  const blockUser = async (userId) => {
    return UserService.blockUser(userId);
  };

  const updateUserPassword = (id: string, password: string) => {
    return UserService.updateUserPassword(id, password);
  };
  const customerUpdateProfile = async (data) => {
    return CustomerService.customerUpdateProfile(data).then((res) => {
      setCustomer({ ...customer, ...data });
      return res;
    });
  };

  const redirectToAdminLogin = async () => {
    await loadUser();
    if (user === undefined) return;
    sessionStorage.setItem(PRE_LOGIN_PATHNAME, location.pathname);
    router.replace("/admin/login");
  };
  const redirectToPartnerLogin = async () => {
    await loadUser();
    if (user === undefined) return;
    sessionStorage.setItem(PRE_LOGIN_PATHNAME, location.pathname);
    router.replace("/partner/login");
  };

  const redirectToAdmin = () => {
    let pathname = sessionStorage.getItem(PRE_LOGIN_PATHNAME);

    if (user) {
      if (pathname?.includes("/admin")) router.replace(pathname || "/admin");
      else router.replace("/admin");
    } else {
      router.replace("/");
    }
  };
  const redirectToPartner = () => {
    let pathname = sessionStorage.getItem(PRE_LOGIN_PATHNAME);
    if (user) {
      if (pathname?.includes("/partner")) router.replace(pathname || "/partner");
      else router.replace("/partner");
    } else {
      router.replace("/");
    }
  };

  const userPermission = (
    scope: keyof typeof SCOPES | (keyof typeof SCOPES)[] | string,
    raw = false
  ) => {
    return typeof scope == "string"
      ? user.scopes.includes(raw ? scope : SCOPES[scope])
      : raw
      ? user.scopes.some((r) => scope.includes(r as any))
      : user.scopes.some((r) => (scope as string[]).map((x) => SCOPES[x]).includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        customer,

        updateUser,
        activeUser,
        blockUser,
        updateUserPassword,
        loginFirebaseEmail,
        loginCustomerByPhone,
        loginCustomerByPhoneAndPassword,
        customerLoginFirebaseEmail,
        loginCustomerWithGoogle,
        resetPasswordFirebaseEmail,
        confirmPasswordReset,
        checkExpiredActionCode,
        logout,
        redirectToAdminLogin,
        redirectToAdmin,
        logoutCustomer,
        customerUpdateProfile,
        userPermission,
        loadCustomer,
        loadUser,
        userExchangePassword,
        customerExchangePassword,
        redirectToPartnerLogin,
        redirectToPartner,
        setCustomer,
        setUser,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );

  function waitForFirebase() {
    console.log("wait for firebase login");
    firebase().then((_firebase) => {
      _firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          UserService.login(await user.getIdToken())
            .then((res) => {
              const { user, token } = res;
              // SetUserToken(token);
              setUser(user);
            })
            .catch((err) => {
              ClearUserToken();
              setUser(null);
            });
        } else {
          ClearUserToken();
          setUser(null);
        }
      });
    });
  }
}

export const useAuth = () => useContext(AuthContext);
