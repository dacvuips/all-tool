import getConfig from "next/config";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { patchYoutubeIframesInElement } from "../../../../lib/helpers/ck-editor-content";
import { compressUploadImage } from "../../../../lib/helpers/image";
import { CompressOptions } from "./image-input";

export interface EditorProps extends FormControlProps {
  minHeight?: string;
  maxHeight?: string;
  maxWidth?: string;
  noBorder?: boolean;
  onFocus?: any;
  onKeyPress?: (value: any) => void;
  hiddenToolbar?: boolean;
  compressUpload?: boolean; //Nén ảnh khi upload
}
export function Editor({
  controlClassName = "form-control",
  className = "flex justify-center px-0 bg-gray-100",
  maxWidth = "960px",
  minHeight = "128px",
  maxHeight = "none",
  hiddenToolbar = false,
  style = {},
  onKeyPress = () => {}, // 13="Enter",	70="f"
  compressUpload = false,

  ...props
}: EditorProps) {
  const [value, setValue] = useState<any>(props.value);
  const [editor, setEditor] = useState<any>();

  useEffect(() => {
    if (props.value !== undefined) {
      setValue(props.value || getDefaultValue({}));
    } else {
      setValue(getDefaultValue({}));
    }
  }, [props.value]);

  const editorRef: MutableRefObject<any> = useRef();
  const [editorLoaded, setEditorLoaded] = useState(false);
  const { CKEditor, InlineEditor } = editorRef.current || {};
  const loadEditor = async () => {
    editorRef.current = {
      CKEditor: await import("@ckeditor/ckeditor5-react").then((mol) => mol.CKEditor),
      InlineEditor: await import("@mcom_solutions/ckeditor5-build").then((mol) => mol.default),
    };
    setEditorLoaded(true);
  };
  useEffect(() => {
    loadEditor();
  }, []);

  const onChange = (data) => {
    setValue(data);

    if (props.onChange) props.onChange(data);
  };

  // useInterval(async () => {
  //   const data = editor.getData();
  //   console.log(data);
  //   // onChange();
  // }, 300);

  useEffect(() => {}, [value, props.value]);
  useEffect(() => {
    if (editor) {
      editor.editing.view.change((writer) => {
        writer.setStyle("min-height", minHeight, editor.editing.view.document.getRoot());
        writer.setStyle("max-height", maxHeight, editor.editing.view.document.getRoot());
        writer.setStyle("max-width", maxWidth, editor.editing.view.document.getRoot());
        writer.setStyle("width", "100%", editor.editing.view.document.getRoot());
        writer.setStyle("border-radius", "inherit", editor.editing.view.document.getRoot());
        writer.setStyle(
          "background-color",
          props.readOnly ? "transparent" : "white",
          editor.editing.view.document.getRoot()
        );
        if (props.noBorder) {
          writer.setStyle("border", "0 !important", editor.editing.view.document.getRoot());
          writer.setStyle("box-shadow", "none !important", editor.editing.view.document.getRoot());
        } else {
          writer.setStyle(
            "box-shadow",
            "0 0 4px 1px rgba(0, 0, 0, 0.08)",
            editor.editing.view.document.getRoot()
          );
        }
      });
      editor.editing.view.document.on("keydown", (event, data) => {
        onKeyPress(data.domEvent);
      });
      // set hidden toolbar
      editor.ui.view.panel.element.setAttribute("style", `display:${hiddenToolbar && "none"}`);
      editor.isReadOnly = props.readOnly;
    }
  }, [props.readOnly, minHeight, maxHeight, editor]);

  return (
    <>
      {editorLoaded ? (
        <div
          className={`${controlClassName} ${props.readOnly ? "readOnly" : ""} ${
            props.error ? "error" : ""
          } ${className}`}
          style={{ ...style }}
        >
          <CKEditor
            editor={InlineEditor}
            data={value}
            config={{
              placeholder: props.placeholder,
              tabindex: "-1",
              extraPlugins: [compressUpload ? UploadAdapterPluginHasCompress : UploadAdapterPlugin],
            }}
            onChange={(event, editor) => {
              onChange(editor.getData());
            }}
            // onBlur={(event, editor) => {
            //   onChange(editor.getData());
            // }}

            onReady={(editor) => {
              setEditor(editor);
              const editable = editor.editing.view.getDomRoot?.() as HTMLElement | null;
              if (!editable) return;

              patchYoutubeIframesInElement(editable);
              const observer = new MutationObserver(() => patchYoutubeIframesInElement(editable));
              observer.observe(editable, { childList: true, subtree: true });
            }}
            onFocus={props.onFocus}
          />
        </div>
      ) : (
        <div className="form-checkbox col-span-12 pt-1.5">
          <i className="self-start pt-0 animate-spin">
            <CgSpinner />
          </i>
          <span className="pl-1.5 loading-ellipsis text-base">Đang tải</span>
        </div>
      )}
    </>
  );
}

const getDefaultValue = (props: EditorProps) => {
  return "";
};

Editor.getDefaultValue = getDefaultValue;

function UploadAdapterPlugin(editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
    // Configure the URL to the upload script in your back-end here!
    return new MyUploadAdapter(loader);
  };
}
function UploadAdapterPluginHasCompress(editor) {
  editor.plugins.get("FileRepository").createUploadAdapter = (loader) => {
    // Configure the URL to the upload script in your back-end here!
    return new MyUploadAdapter(loader, true, { width: 900, height: 900, quality: 60 });
  };
}
class MyUploadAdapter {
  xhr: XMLHttpRequest;
  loader: any;
  compressUpload?: boolean;
  compressUploadOptions?: CompressOptions;

  constructor(loader, compressUpload?: boolean, compressUploadOptions?: CompressOptions) {
    // The file loader instance to use during the upload.
    this.loader = loader;
    this.compressUpload = compressUpload;
    this.compressUploadOptions = compressUploadOptions;
  }

  // Starts the upload process.
  upload() {
    return this.loader.file.then(
      (file) =>
        new Promise((resolve, reject) => {
          this._initRequest();
          this._initListeners(resolve, reject, file);
          this._sendRequest(file, this.compressUpload, this.compressUploadOptions);
        })
    );
  }

  // Aborts the upload process.
  abort() {
    if (this.xhr) {
      this.xhr.abort();
    }
  }

  // Initializes the XMLHttpRequest object using the URL passed to the constructor.
  _initRequest() {
    const xhr = (this.xhr = new XMLHttpRequest());
    const {
      publicRuntimeConfig: { upload },
    } = getConfig();
    // Note that your request may look different. It is up to you and your editor
    // integration to choose the right communication channel. This example uses
    // a POST request with JSON as a data structure but your configuration
    // could be different.
    xhr.open("POST", upload.uploadImageApiLink, true);
    xhr.responseType = "json";
  }

  // Initializes XMLHttpRequest listeners.
  _initListeners(resolve, reject, file) {
    const xhr = this.xhr;
    const loader = this.loader;
    const genericErrorText = `Tải ảnh thất bại: ${file.name}.`;

    xhr.addEventListener("error", () => {
      reject(genericErrorText);
    });

    xhr.addEventListener("abort", () => reject());
    xhr.addEventListener("load", () => {
      const response = xhr.response;

      // This example assumes the XHR server's "response" object will come with
      // an "error" which has its own "message" that can be passed to reject()
      // in the upload promise.
      //
      // Your integration may handle upload errors in a different way so make sure
      // it is done properly. The reject() function must be called when the upload fails.
      if (!response || response.error || !response.success) {
        return reject(
          response
            ? response.error
              ? response.error.message
              : response.data?.error
            : genericErrorText
        );
      }

      // If the upload is successful, resolve the upload promise with an object containing
      // at least the "default" URL, pointing to the image on the server.
      // This URL will be used to display the image in the content. Learn more in the
      // UploadAdapter#upload documentation.
      resolve({
        default: response.data?.link,
      });
    });

    // Upload progress when it is supported. The file loader has the #uploadTotal and #uploaded
    // properties which are used e.g. to display the upload progress bar in the editor
    // user interface.
    if (xhr.upload) {
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          loader.uploadTotal = evt.total;
          loader.uploaded = evt.loaded;
        }
      });
    }
  }

  // Prepares the data and sends the request.
  async _sendRequest(file, compressUpload?: boolean, compressUploadOptions?: CompressOptions) {
    // Prepare the form data.
    const data = new FormData();
    if (compressUpload) {
      // compress image before upload to server
      const imgCompress = await compressUploadImage(file, compressUploadOptions);
      data.append("image", imgCompress as any);
    } else {
      // normal
      data.append("image", file);
    }

    // Important note: This is the right place to implement security mechanisms
    // like authentication and CSRF protection. For instance, you can use
    // XMLHttpRequest.setRequestHeader() to set the request headers containing
    // the CSRF token generated earlier by your application.

    // Send the request.
    this.xhr.send(data);
  }
}
