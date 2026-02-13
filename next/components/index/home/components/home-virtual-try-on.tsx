import { useCallback, useEffect, useState } from "react";
// Import Firebase SDKs (Giả định đã được cài đặt trong môi trường Next.js/React)
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
} from "firebase/auth";
import { getFirestore, setLogLevel } from "firebase/firestore";
import getConfig from "next/config";

// --- Khai báo hằng số toàn cục (Từ môi trường Canvas) ---
// CHÚ Ý: Trong môi trường Next.js thực tế, bạn sẽ cần tải các biến này
// từ biến môi trường (.env) hoặc context.
const getGlobalVar = (name, defaultValue) =>
  typeof window !== "undefined" && typeof window[name] !== "undefined"
    ? window[name]
    : defaultValue;
const {
  publicRuntimeConfig: { firebaseView },
} = getConfig();
const globalAppId = getGlobalVar("__app_id", "default-app-id");
const globalFirebaseConfig = getGlobalVar("__firebase_config", firebaseView);
const globalInitialAuthToken = getGlobalVar("__initial_auth_token", null);

const API_KEY = "AIzaSyCc2aUF2cWmzhDZ2mw5bLnftjTX5dVf5W4"; // Key sẽ được cung cấp tự động khi chạy trong Canvas
const MODEL_NAME = "gemini-2.5-flash-image-preview";
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

// Hàm chuyển đổi File sang Base64
const toBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result.split(",")[1]); // Lấy phần data base64
      } else {
        reject(new Error("Failed to read file as data URL"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

export const HomeVirtualTryOn = () => {
  // State cho Auth và Firebase
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State cho Input
  const [modelImage, setModelImage] = useState(null);
  const [garmentImage, setGarmentImage] = useState(null);
  const [prompt, setPrompt] = useState("");

  // State cho Output/Process
  const [resultImage, setResultImage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({
    text: "Vui lòng tải lên ảnh người mẫu và ảnh trang phục.",
    type: "info",
  });

  // --- 1. FIREBASE INITIALIZATION & AUTH ---
  useEffect(() => {
    try {
      setLogLevel("debug");
      // Handle both object and string cases
      const firebaseConfig =
        typeof globalFirebaseConfig === "string"
          ? JSON.parse(globalFirebaseConfig)
          : globalFirebaseConfig;

      if (Object.keys(firebaseConfig).length === 0) {
        setMessage({ text: "Lỗi: Firebase Config không khả dụng.", type: "error" });
        return;
      }

      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);
      setAuth(authInstance);
      setDb(dbInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (!user) {
          // Cố gắng đăng nhập với token hoặc ẩn danh
          try {
            if (globalInitialAuthToken) {
              await signInWithCustomToken(authInstance, globalInitialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
          } catch (error) {
            console.error("Lỗi xác thực:", error);
            setMessage({ text: "Lỗi xác thực Firebase. Vui lòng thử lại.", type: "error" });
          }
        }

        // Cập nhật state sau khi có user (dù là user mới hay cũ)
        setUserId(authInstance.currentUser?.uid);
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Lỗi khởi tạo Firebase:", error);
      setMessage({ text: "Lỗi khởi tạo Firebase. (Xem console)", type: "error" });
    }
  }, []);

  // --- 2. XỬ LÝ IMAGE UPLOAD ---
  const handleImageUpload = async (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setMessage({ text: "Kích thước ảnh quá lớn (tối đa 4MB).", type: "error" });
      event.target.value = ""; // Reset input
      return;
    }

    try {
      const base64Data = await toBase64(file);
      const mimeType = file.type;
      const imageData = { base64Data, mimeType, url: URL.createObjectURL(file) };

      if (type === "model") {
        setModelImage(imageData);
      } else {
        setGarmentImage(imageData);
      }
      setMessage({ text: "", type: "info" }); // Clear previous error
    } catch (error) {
      console.error("Lỗi xử lý file:", error);
      setMessage({ text: "Không thể đọc file ảnh. Vui lòng thử lại.", type: "error" });
    }
  };

  // Kiểm tra tính hợp lệ của form để bật/tắt nút
  const isFormValid = modelImage && garmentImage && isAuthReady && !isLoading;

  // --- 3. HÀM GỌI API GEMINI (Có Retry) ---
  const callGeminiApiWithRetry = useCallback(async (payload, maxRetries = 5) => {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
    let delay = 1000;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 && i < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          throw new Error(`Lỗi HTTP: ${response.status} - ${response.statusText}`);
        }

        return response.json();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }, []);

  // --- 4. HÀM CHÍNH: THỬ ĐỒ ẢO ---
  const tryOn = async () => {
    if (!isFormValid) {
      setMessage({ text: "Vui lòng hoàn tất tải ảnh và chờ xác thực Firebase.", type: "error" });
      return;
    }

    setIsLoading(true);
    setResultImage("");
    setMessage({ text: "Đang gửi yêu cầu tạo hình ảnh...", type: "info" });

    // A. SYSTEM INSTRUCTION CHUẨN (Quan trọng để định hình nhiệm vụ của AI)
    const systemPrompt = `Act as a professional virtual try-on system. Your task is to swap the clothes worn by the person in the FIRST image (Model Image) with the garment item shown in the SECOND image (Garment Image). 
        Maintain the model's exact pose, lighting, shadows, and background. Ensure the new garment fits realistically according to the model's body shape and the garment's style. 
        Focus on seamless blending and realistic texture transfer. The user may provide additional instructions in the text prompt: "${prompt}". 
        Generate ONLY the resulting image and no text explanation.`;

    // B. USER PROMPT CHUẨN (Mô tả hành động)
    const userQuery = `Swap the clothing on the person in the Model Image with the Garment Image. Apply these additional details: ${
      prompt || "None"
    }`;

    // C. HTTP REQUEST PAYLOAD CHUẨN (Body JSON)
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            // 1. Ảnh người mẫu (Context/Base Image)
            {
              inlineData: {
                mimeType: modelImage.mimeType,
                data: modelImage.base64Data,
              },
            },
            // 2. Ảnh trang phục (Reference/Input Garment)
            {
              inlineData: {
                mimeType: garmentImage.mimeType,
                data: garmentImage.base64Data,
              },
            },
            // 3. Text Prompt (Instruction)
            { text: userQuery },
          ],
        },
      ],
      generationConfig: {
        // Yêu cầu mô hình trả về cả TEXT (cho lý do an toàn) và IMAGE
        responseModalities: ["TEXT", "IMAGE"],
      },
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    console.log("--- HTTP Request Payload (Body JSON) ---");
    console.log(JSON.stringify(payload, null, 2));
    console.log("---------------------------------------");

    try {
      const result = await callGeminiApiWithRetry(payload);
      const candidate = result?.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find(
        (p) => p.inlineData && p.inlineData.mimeType.startsWith("image/")
      );

      if (imagePart) {
        const base64Data = imagePart.inlineData.data;
        const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64Data}`;
        setResultImage(imageUrl);
        setMessage({ text: "Thử đồ thành công! Xem kết quả.", type: "success" });
      } else {
        const safetyReason =
          candidate?.finishReason === "SAFETY"
            ? " (Lý do An toàn: Ảnh hoặc prompt vi phạm chính sách)"
            : "";
        setMessage({
          text: `Không thể tạo hình ảnh. Vui lòng thử lại với ảnh hoặc prompt khác.${safetyReason}`,
          type: "error",
        });
        console.error("API response missing image part:", result);
      }
    } catch (error) {
      console.error("Lỗi gọi API Gemini:", error);
      setMessage({
        text: `Lỗi hệ thống: Không thể kết nối với dịch vụ AI. ${error.message}`,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI HELPER COMPONENTS ---
  const FileInputCard = ({ label, id, onUpload, previewImage, type }) => (
    <div className="p-4 mb-6 bg-gray-50 rounded-lg border border-gray-200">
      <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>
      <input
        type="file"
        id={id}
        accept="image/*"
        className="w-full text-sm text-gray-500 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
        onChange={(e) => onUpload(e, type)}
      />
      <div
        className={`mt-4 ${
          previewImage ? "block" : "hidden"
        } border-2 border-dashed border-gray-300 rounded-md p-2 bg-white`}
      >
        <img
          src={previewImage?.url}
          className="object-contain w-full h-auto max-h-40 rounded-sm"
          alt="Ảnh xem trước"
        />
      </div>
    </div>
  );

  // --- RENDERING ---
  return (
    <div className="p-4 min-h-screen md:p-8 bg-f7f9fb">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-gray-800">
            <span className="text-indigo-600">Virtual Try-On</span> (Next.js)
          </h1>
          <p className="mt-2 text-lg text-gray-500">
            Ghép trang phục từ ảnh tham chiếu bằng mô hình {MODEL_NAME}.
          </p>
        </header>

        <div id="appContainer" className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Cột Điều Khiển */}
          <div className="sticky top-8 p-6 bg-white rounded-xl lg:col-span-1 card-shadow h-fit">
            <h2 className="pb-2 mb-4 text-2xl font-semibold text-gray-700 border-b">
              1. Đầu vào (2 Ảnh)
            </h2>

            <FileInputCard
              label="Ảnh Người Mẫu/Cơ Thể"
              id="modelImageInput"
              onUpload={handleImageUpload}
              previewImage={modelImage}
              type="model"
            />

            <FileInputCard
              label="Ảnh Trang Phục (Reference)"
              id="garmentImageInput"
              onUpload={handleImageUpload}
              previewImage={garmentImage}
              type="garment"
            />

            {/* Khu vực Mô Tả Chi Tiết */}
            <div className="pt-4 mb-6 border-t">
              <label htmlFor="promptInput" className="block mb-2 text-sm font-medium text-gray-700">
                2. Mô tả chi tiết (Tùy chọn, nên dùng tiếng Anh)
              </label>
              <textarea
                id="promptInput"
                rows={2}
                placeholder="Ví dụ: Make the garment appear slightly oversized and cotton texture."
                className="p-3 w-full rounded-lg border border-gray-300 transition duration-150 focus:ring-indigo-500 focus:border-indigo-500"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Nút Thử Đồ */}
            <button
              id="tryOnButton"
              className={`w-full py-3 px-4 text-white font-bold rounded-xl transition duration-300 flex items-center justify-center 
                                ${
                                  isFormValid
                                    ? "bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500 focus:ring-opacity-50"
                                    : "bg-indigo-400 cursor-not-allowed"
                                }`}
              onClick={tryOn}
              disabled={!isFormValid}
            >
              <svg
                className={`w-5 h-5 mr-2 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              <span>{isLoading ? "Đang tạo..." : "Thử Đồ Ngay"}</span>
            </button>

            {/* Khung Thông Báo */}
            <div
              className={`mt-4 p-3 rounded-lg text-sm ${message.text ? "block" : "hidden"} 
                                ${
                                  message.type === "error"
                                    ? "bg-red-100 text-red-700"
                                    : message.type === "success"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
              role="alert"
            >
              {message.text}
            </div>
            {/* Hiển thị trạng thái Auth */}
            <p className="mt-2 text-xs text-gray-500">
              {isAuthReady
                ? `Auth: Đã sẵn sàng (${userId.substring(0, 8)}...)`
                : "Đang chờ xác thực..."}
            </p>
          </div>

          {/* Cột Kết Quả */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-xl card-shadow min-h-[500px]">
              <h2 className="pb-2 mb-4 text-2xl font-semibold text-gray-700 border-b">
                3. Kết Quả Thử Đồ
              </h2>

              {/* Khu vực Tải */}
              <div className={`text-center py-16 ${isLoading ? "block" : "hidden"}`}>
                <div className="flex justify-center space-x-2">
                  <span className="w-3 h-3 bg-indigo-600 rounded-full loading-dot"></span>
                  <span className="w-3 h-3 bg-indigo-600 rounded-full loading-dot"></span>
                  <span className="w-3 h-3 bg-indigo-600 rounded-full loading-dot"></span>
                </div>
                <p className="mt-4 font-medium text-indigo-600">
                  Đang tạo hình ảnh thử đồ... (Có thể mất 15-30 giây).
                </p>
              </div>

              {/* Khu vực Hình ảnh Kết quả */}
              <div className="flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 min-h-[400px]">
                {resultImage ? (
                  <img
                    src={resultImage}
                    className="w-full h-auto max-h-[80vh] object-contain rounded-md"
                    alt="Kết quả thử đồ AI"
                  />
                ) : (
                  <p className={`text-gray-500 ${isLoading ? "hidden" : "block"}`}>
                    Kết quả thử đồ sẽ hiển thị ở đây.
                  </p>
                )}
              </div>

              {/* Khu vực Thông tin API */}
              <div className="p-3 mt-4 bg-indigo-50 rounded-lg">
                <p className="text-sm font-semibold text-indigo-700">
                  Mô hình đã sử dụng:{" "}
                  <code className="p-1 bg-indigo-200 rounded">{MODEL_NAME}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
