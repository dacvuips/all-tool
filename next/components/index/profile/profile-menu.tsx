import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiExit } from "react-icons/bi";
import { useAuth } from "../../../lib/providers/auth-provider";
import { Img } from "../../shared/utilities/misc";
import { ProfileMenuList } from "./profile-page";

export function ProfileMenu({ selectedMenu, ...props }) {
  const { t } = useTranslation();
  const { customer, logoutCustomer } = useAuth();
  const router = useRouter();
  const PROFILE_MENUS = ProfileMenuList();

  const tabsRef = useRef<HTMLDivElement>(null);
  const inkbarRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Find active index based on selectedMenu
  useEffect(() => {
    if (selectedMenu) {
      const idx = PROFILE_MENUS.findIndex((m) => m.href === selectedMenu.href);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [selectedMenu]);

  // Animate ink bar
  useEffect(() => {
    if (tabsRef.current && inkbarRef.current) {
      const tabEl = tabsRef.current.children[activeIndex] as HTMLElement;
      if (tabEl) {
        inkbarRef.current.style.width = `${tabEl.offsetWidth}px`;
        inkbarRef.current.style.left = `${tabEl.offsetLeft}px`;
        // Scroll active tab into view on mobile
        tabEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [activeIndex, tabsRef.current]);

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
      {/* User Info Header */}
      {customer && (
        <div className="flex items-center gap-3 md:gap-3.5 px-3 md:px-5 py-3 md:py-4 border-b border-gray-100 bg-gradient-to-br from-primary-light to-white">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Img
              src={customer?.avatarUrl ? customer?.avatarUrl : "/assets/default/avatar.png"}
              className="w-9 h-9 md:w-12 md:h-12 rounded-full object-cover border-2 border-primary"
              style={{ boxShadow: "0 0 0 3px rgba(242, 137, 13, 0.15)" }}
            />
            <div
              className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white ${
                customer.status === "ACTIVE" ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
          {/* User Info */}
          <div className="flex-1 min-w-0 flex flex-col gap-px">
            <span className="text-xs text-gray-400 font-medium tracking-wide">
              {t("Tài khoản của")}
            </span>
            <span className="text-sm md:text-15 font-bold text-accent capitalize whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
              {customer.name ? customer.name : customer.phoneNumber}
            </span>
          </div>
          {/* Logout Button */}
          <button
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary-light text-primary text-base md:text-lg cursor-pointer border-none transition-all duration-200 hover:bg-primary hover:text-white hover:scale-105 hover:shadow-md active:scale-95"
            onClick={() => {
              logoutCustomer();
              router.replace("/");
            }}
            title={t("Đăng xuất")}
          >
            <BiExit />
          </button>
        </div>
      )}

      {/* Horizontal Tab Navigation */}
      <div className="relative overflow-hidden">
        <div className="flex overflow-x-auto no-scrollbar relative" ref={tabsRef}>
          {PROFILE_MENUS.map((item, index) => {
            const isActive = item.href === selectedMenu?.href;
            return (
              <Link
                href={item.href}
                key={index}
                className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 md:py-3.5 whitespace-nowrap cursor-pointer no-underline font-medium text-xs md:text-sm flex-shrink-0 border-b-2 transition-all duration-200 ${
                  isActive
                    ? "text-primary font-semibold border-primary bg-primary-light bg-opacity-50"
                    : "text-gray-500 border-transparent hover:text-primary hover:bg-primary-light hover:bg-opacity-30"
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <span
                  className={`flex items-center text-base md:text-lg flex-shrink-0 transition-transform duration-200 ${
                    isActive ? "scale-110" : ""
                  }`}
                >
                  {item.icon}
                </span>
                <span className="hidden xs:inline leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
        {/* Animated Ink Bar */}
        <div
          className="absolute bottom-0 h-0.5 bg-gradient-to-r from-primary to-yellow-400 rounded-t-sm z-10"
          ref={inkbarRef}
          style={{
            transition: "left 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}
