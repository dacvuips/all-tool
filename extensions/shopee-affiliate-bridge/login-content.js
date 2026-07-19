/**
 * Content script — trang login Shopee.
 * Điền username/password, click login.
 * Gặp captcha (puzzle / ảnh) → báo chờ, đợi user giải xong rồi tiếp tục.
 *
 * Không dùng sendResponse sau khi click login (trang redirect sẽ hủy script
 * → lỗi "message channel closed"). Kết quả gửi về background qua
 * chrome.runtime.sendMessage(SHOPEE_LOGIN_RESULT).
 */
(function () {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width >= 8 && rect.height >= 8;
  }

  /**
   * Captcha đang hiện: puzzle kéo / chọn ảnh / verify modal.
   * Không dùng class*=captcha chung (Shopee có DOM ẩn → false positive).
   */
  function hasCaptcha() {
    const nodes = document.querySelectorAll("div, section, aside, dialog");
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const text = String(el.innerText || "");
      if (text.length < 12 || text.length > 4000) continue;

      const hasTitle =
        /Verify to Continue/i.test(text) ||
        /Xác minh để tiếp tục/i.test(text) ||
        /Security Verification/i.test(text) ||
        /Xác minh bảo mật/i.test(text);

      const hasSlideHint =
        /Please slide to complete the puzzle/i.test(text) ||
        /slide to complete the puzzle/i.test(text) ||
        /Kéo thanh để hoàn thành/i.test(text);

      const hasImageHint =
        /select all (images|pictures)/i.test(text) ||
        /Please select/i.test(text) ||
        /Chọn tất cả/i.test(text) ||
        /nhấn vào/i.test(text) ||
        /click (on|the)/i.test(text);

      if (hasTitle && (hasSlideHint || hasImageHint)) return true;
      // Modal verify có canvas/ảnh captcha lớn
      if (hasTitle) {
        const media = el.querySelectorAll("canvas, img");
        for (const m of media) {
          if (!isVisible(m)) continue;
          const r = m.getBoundingClientRect();
          if (r.width >= 80 && r.height >= 80) return true;
        }
      }
    }
    return false;
  }

  function findLoginKey() {
    return (
      document.querySelector('input[name="loginKey"]') ||
      document.querySelector('input[placeholder*="Phone number"]') ||
      document.querySelector('input[placeholder*="Username"]') ||
      document.querySelector('input[type="text"][autocomplete="on"]')
    );
  }

  function findPassword() {
    return (
      document.querySelector('input[name="password"]') ||
      document.querySelector('input[type="password"]')
    );
  }

  function findLoginButton() {
    const buttons = Array.from(document.querySelectorAll("button"));
    return (
      buttons.find((b) =>
        /^(LOG IN|Log In|Đăng nhập|ĐĂNG NHẬP)$/i.test(String(b.textContent || "").trim())
      ) ||
      buttons.find((b) => /log\s*in|đăng\s*nhập/i.test(String(b.textContent || ""))) ||
      null
    );
  }

  function setNativeValue(input, value) {
    const proto = window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc?.set) desc.set.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  function postLoginResult(payload) {
    chrome.runtime.sendMessage({ type: "SHOPEE_LOGIN_RESULT", ...payload }).catch(() => {});
  }

  function postCaptchaWait(reason) {
    chrome.runtime
      .sendMessage({
        type: "SHOPEE_LOGIN_CAPTCHA_WAIT",
        reason: reason || "Gặp captcha — đang chờ bạn giải trên tab Shopee",
      })
      .catch(() => {});
  }

  /** Chờ user giải captcha; trả true nếu hết captcha, false nếu hết giờ. */
  async function waitForCaptchaSolved(timeoutMs = 240000) {
    if (!hasCaptcha()) return true;
    postCaptchaWait("Gặp captcha ảnh/puzzle — hãy giải trên tab Shopee, đang chờ…");
    const started = Date.now();
    let lastNotify = started;
    while (Date.now() - started < timeoutMs) {
      if (!hasCaptcha()) {
        // Debounce ngắn — captcha có thể reload ảnh mới
        await sleep(800);
        if (!hasCaptcha()) return true;
      }
      // Nhắc lại mỗi 30s
      if (Date.now() - lastNotify > 30000) {
        postCaptchaWait("Vẫn đang chờ giải captcha trên tab Shopee…");
        lastNotify = Date.now();
      }
      await sleep(400);
    }
    return !hasCaptcha();
  }

  async function waitForLoginForm(timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (hasCaptcha()) {
        const ok = await waitForCaptchaSolved(240000);
        if (!ok) return { captchaTimeout: true };
        continue;
      }
      const loginKey = findLoginKey();
      const password = findPassword();
      if (loginKey && password && isVisible(loginKey) && isVisible(password)) {
        return { captcha: false, loginKey, password };
      }
      await sleep(300);
    }
    return { captcha: false };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "CHECK_SHOPEE_CAPTCHA") {
      sendResponse({ captcha: hasCaptcha() });
      return false;
    }

    if (message?.type === "GET_DOCUMENT_COOKIES") {
      sendResponse({ cookie: String(document.cookie || "") });
      return false;
    }

    if (message?.type !== "RUN_SHOPEE_LOGIN") return false;

    // Trả lời ngay — không giữ channel trong lúc login/redirect
    sendResponse({ ok: true, accepted: true });

    (async () => {
      try {
        const username = String(message.username || "");
        const password = String(message.password || "");
        if (!username || !password) {
          postLoginResult({ ok: false, error: "Thiếu username/password" });
          return;
        }

        const form = await waitForLoginForm(20000);
        if (form.captchaTimeout) {
          postLoginResult({
            ok: false,
            captcha: true,
            error: "Hết thời gian chờ giải captcha",
          });
          return;
        }
        if (!form.loginKey || !form.password) {
          postLoginResult({ ok: false, error: "Không thấy form login" });
          return;
        }

        setNativeValue(form.loginKey, username);
        setNativeValue(form.password, password);
        await sleep(1500);

        if (hasCaptcha()) {
          const ok = await waitForCaptchaSolved(240000);
          if (!ok) {
            postLoginResult({
              ok: false,
              captcha: true,
              error: "Hết thời gian chờ giải captcha",
            });
            return;
          }
        }

        const btn = findLoginButton();
        if (!btn) {
          postLoginResult({ ok: false, error: "Không tìm thấy nút LOG IN" });
          return;
        }
        btn.click();

        // Sau click: captcha ảnh thường hiện — chờ user giải, BG cũng theo dõi redirect.
        const watchUntil = Date.now() + 12000;
        while (Date.now() < watchUntil) {
          if (hasCaptcha()) {
            const ok = await waitForCaptchaSolved(240000);
            if (!ok) {
              postLoginResult({
                ok: false,
                captcha: true,
                error: "Hết thời gian chờ giải captcha",
              });
              return;
            }
            // Giải xong có thể cần click login lại
            const btn2 = findLoginButton();
            if (btn2 && isVisible(btn2)) {
              btn2.click();
              await sleep(1000);
            }
            break;
          }
          // Đã rời trang login → script sẽ bị hủy; BG bắt success qua onUpdated
          if (!/\/buyer\/(login|signin)/i.test(location.pathname + location.href)) {
            postLoginResult({ ok: true, navigated: true });
            return;
          }
          await sleep(300);
        }

        // Vẫn trên login, không còn captcha — BG tiếp tục chờ redirect / timeout
        postLoginResult({ ok: true, clicked: true });
      } catch (err) {
        postLoginResult({ ok: false, error: err?.message || String(err) });
      }
    })();

    return false;
  });
})();
