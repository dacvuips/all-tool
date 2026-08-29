export function renderFacebookOAuthCallbackHtml(input: {
  status: "success" | "error";
  connectSessionId?: string;
  message?: string;
}): string {
  const payload = JSON.stringify({
    type: "affiliate-facebook-oauth",
    status: input.status,
    connectSessionId: input.connectSessionId || null,
    message: input.message || null,
  });

  const title = input.status === "success" ? "Kết nối Facebook thành công" : "Kết nối Facebook thất bại";
  const bodyText =
    input.status === "success"
      ? "Đang quay lại ứng dụng…"
      : input.message || "Không thể kết nối Facebook";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f8fafc; color:#334155; }
    .box { text-align:center; padding:24px; }
  </style>
</head>
<body>
  <div class="box">
    <p>${bodyText}</p>
    <p style="font-size:12px;color:#94a3b8;">Cửa sổ sẽ tự đóng…</p>
  </div>
  <script>
    (function () {
      var payload = ${payload};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(payload, window.location.origin);
        }
      } catch (e) {}
      setTimeout(function () { window.close(); }, 400);
    })();
  </script>
</body>
</html>`;
}
