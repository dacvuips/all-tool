import getConfig from "next/config";

let _firebase: any;

const firebase = async () => {
  if (_firebase) return _firebase;
  _firebase = await import("firebase/compat/app").then((mol) => mol.default);
  const {
    publicRuntimeConfig: { firebaseView },
  } = getConfig();
  if (_firebase.apps.length == 0) {
    _firebase.initializeApp(firebaseView);
  }
  await import("firebase/compat/auth");
  return _firebase;
};

export { firebase };
