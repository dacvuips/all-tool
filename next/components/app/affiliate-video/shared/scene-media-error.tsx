/** Hiển thị lỗi generate ảnh/video inline trong scene card */
export function SceneMediaError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2 py-1.5 text-center leading-snug">
      {message}
    </p>
  );
}
