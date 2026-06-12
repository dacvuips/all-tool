import { TrendingTypeEnum } from "../../../../lib/repo/list/trending.repo";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";

export type AppTrendingType =
  | TrendingTypeEnum.FLOW_APP
  | TrendingTypeEnum.AI_STUDIO_APP
  | TrendingTypeEnum.CHATBOT;

export function useAppTypeConfig(type: AppTrendingType) {
  const api = useAffiliateVideoApi();

  if (type === TrendingTypeEnum.FLOW_APP) {
    return {
      type,
      getByCategoryId: api.getFlowAppsByCategoryId,
      getCustomerList: api.getCustomerFlowAppList,
      create: api.createCustomerFlowApp,
      update: api.updateCustomerFlowApp,
      delete: api.deleteCustomerFlowApp,
      listTabLabel: "Flow App",
      itemLabel: "Flow App",
      createDialogTitle: "Tạo Flow App",
      editDialogTitle: "Sửa Flow App",
      nameFieldLabel: "Tên Flow App",
      namePlaceholder: "Nhập tên Flow App...",
      guideFieldLabel: "Hướng dẫn sử dụng Flow App",
      deleteConfirm: "Bạn có chắc muốn xoá Flow App này?",
      deleteSuccess: "Đã xoá Flow App",
      updateSuccess: "Đã cập nhật Flow App",
      createSuccess: "Đã tạo Flow App mới",
      notifyText:
        "Bạn hoàn toàn có thể kiếm thêm thu nhập từ Flow App bạn đưa lên! Hãy tạo mới và công khai để kiếm thêm thu nhập!",
    };
  }

  if (type === TrendingTypeEnum.CHATBOT) {
    return {
      type,
      getByCategoryId: api.getChatbotsByCategoryId,
      getCustomerList: api.getCustomerChatbotList,
      create: api.createCustomerChatbot,
      update: api.updateCustomerChatbot,
      delete: api.deleteCustomerChatbot,
      listTabLabel: "ChatBot",
      itemLabel: "ChatBot",
      createDialogTitle: "Tạo ChatBot",
      editDialogTitle: "Sửa ChatBot",
      nameFieldLabel: "Tên ChatBot",
      namePlaceholder: "Nhập tên ChatBot...",
      guideFieldLabel: "Hướng dẫn sử dụng ChatBot",
      deleteConfirm: "Bạn có chắc muốn xoá ChatBot này?",
      deleteSuccess: "Đã xoá ChatBot",
      updateSuccess: "Đã cập nhật ChatBot",
      createSuccess: "Đã tạo ChatBot mới",
      notifyText:
        "Bạn hoàn toàn có thể kiếm thêm thu nhập từ ChatBot bạn đưa lên! Hãy tạo mới và công khai để kiếm thêm thu nhập!",
    };
  }

  return {
    type,
    getByCategoryId: api.getAiStudioAppsByCategoryId,
    getCustomerList: api.getCustomerAiStudioAppList,
    create: api.createCustomerAiStudioApp,
    update: api.updateCustomerAiStudioApp,
    delete: api.deleteCustomerAiStudioApp,
    listTabLabel: "AI Studio App",
    itemLabel: "AI Studio App",
    createDialogTitle: "Tạo AI Studio App",
    editDialogTitle: "Sửa AI Studio App",
    nameFieldLabel: "Tên AI Studio App",
    namePlaceholder: "Nhập tên AI Studio App...",
    guideFieldLabel: "Hướng dẫn sử dụng AI Studio App",
    deleteConfirm: "Bạn có chắc muốn xoá AI Studio App này?",
    deleteSuccess: "Đã xoá AI Studio App",
    updateSuccess: "Đã cập nhật AI Studio App",
    createSuccess: "Đã tạo AI Studio App mới",
    notifyText:
      "Bạn hoàn toàn có thể kiếm thêm thu nhập từ AI Studio App bạn đưa lên! Hãy tạo mới và công khai để kiếm thêm thu nhập!",
  };
}

export type AppTypeConfig = ReturnType<typeof useAppTypeConfig>;
