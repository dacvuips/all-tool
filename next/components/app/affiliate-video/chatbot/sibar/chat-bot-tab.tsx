/**

 * chat-bot-tab.tsx

 * Sidebar layout: ChatBot AI

 */

import { useMemo } from "react";

import { useTranslation } from "react-i18next";

import { FaRobot } from "react-icons/fa";

import { RiCloseLine } from "react-icons/ri";

import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";

import { AffiliateSidebarGuideButton } from "../../shared/affiliate-sidebar-guide-button";

import { useAffiliateSidebarIntro } from "../../shared/use-affiliate-sidebar-intro";

import { ChatBotSidebar } from "./chat-bot-panel";



export const ChatBotSidebarTab = ({ onClose }: { onClose?: () => void }) => {

  const { t } = useTranslation();

  const { introOpen, openIntro, handleIntroDismiss } = useAffiliateSidebarIntro(

    IntroGuideKey.CHATBOT_SIDEBAR

  );



  const introProps = useMemo(

    () => ({ introOpen, onIntroDismiss: handleIntroDismiss }),

    [introOpen, handleIntroDismiss]

  );



  return (

    <>

      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">

        <div className="flex gap-2 items-center">

          <div className="flex justify-center items-center w-8 h-8 bg-red-500 rounded-full">

            <FaRobot className="text-base text-white" />

          </div>

          <div className="flex gap-1.5 items-center">

            <span className="text-base font-bold text-gray-800">{t("ChatBot AI")}</span>

            <AffiliateSidebarGuideButton id="chatbot-guide-btn" onClick={openIntro} />

          </div>

        </div>

        <div className="flex gap-1 items-center">

          {onClose && (

            <button

              type="button"

              onClick={onClose}

              className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer md:hidden hover:bg-gray-200"

            >

              <RiCloseLine className="text-lg text-gray-600" />

            </button>

          )}

        </div>

      </div>

      <ChatBotSidebar introProps={introProps} />

    </>

  );

};

