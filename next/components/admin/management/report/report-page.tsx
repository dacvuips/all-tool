import { ReportTransactionAllUser } from "./components/report-transaction-all-user";

export function ReportPage(props) {
  return (
    <div className="w-full min-w-7xl">
      {
        <div className="grid grid-cols-2 gap-3 animate-emerge-up">
          <ReportTransactionAllUser />
        </div>
      }
    </div>
  );
}
