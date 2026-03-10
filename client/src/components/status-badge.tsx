import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  lead: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  not_started: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  submitted: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  document_collection: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  pending_tax_authority: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  income: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  expense: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  initial_process: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  waiting_for_documents: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  ready_for_case_opening: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  in_treatment: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  transferred_to_accountant: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  ready_for_submission: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  submitted_to_tax_authority: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  paid_and_closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  not_relevant: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  no_answer_1: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  no_answer_2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  no_answer_3: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  no_answer_4: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  no_answer_5: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  no_answer_6: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  talked: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  sent_documents: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  closed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  details_received: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  waiting_documents: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  document_review: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  submitted_to_tax: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

const hebrewLabels: Record<string, string> = {
  lead: "ליד",
  active: "פעיל",
  inactive: "לא פעיל",
  new: "חדש",
  in_progress: "בטיפול",
  completed: "תקבול",
  not_started: "טרם התחיל",
  submitted: "הוגש",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל",
  paid: "שולם",
  pending: "ממתין",
  document_collection: "איסוף מסמכים",
  review: "בבדיקה",
  pending_tax_authority: "ממתין לרשות המסים",
  high: "גבוהה",
  medium: "בינונית",
  low: "נמוכה",
  income: "הכנסה",
  expense: "הוצאה",
  initial_process: "תהליך ראשוני",
  waiting_for_documents: "ממתין למסמכים",
  ready_for_case_opening: "מוכן לפתיחת תיק",
  in_treatment: "בטיפול",
  transferred_to_accountant: "הועבר לרואה חשבון",
  ready_for_submission: "מוכן להגשה",
  submitted_to_tax_authority: "הוגש לרשות המסים",
  paid_and_closed: "שולם ונסגר",
  not_relevant: "לא רלוונטי",
  no_answer_1: "אין מענה 1",
  no_answer_2: "אין מענה 2",
  no_answer_3: "אין מענה 3",
  no_answer_4: "אין מענה 4",
  no_answer_5: "אין מענה 5",
  no_answer_6: "אין מענה 6",
  talked: "דיברנו",
  sent_documents: "שלח מסמכים",
  closed: "נסגר",
  details_received: "פרטים התקבלו",
  waiting_documents: "מחכים למסמכים",
  document_review: "בדיקת מסמכים",
  submitted_to_tax: "הוגש למס הכנסה",
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return null;
  const colorClass = statusColors[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  const label = hebrewLabels[status] || status;
  return (
    <Badge
      variant="outline"
      className={`${colorClass} border-transparent text-xs font-medium ${className || ""}`}
      data-testid={`badge-status-${status}`}
    >
      {label}
    </Badge>
  );
}
