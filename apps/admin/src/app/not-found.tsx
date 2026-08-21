import { adminPath } from "@/lib/admin-path";
import { Icon } from "@/components/ui/icon";
import { TextLink } from "@/components/ui/buttons";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--page-bg)] px-6 text-center">
      <Icon name="warning" size={20} />
      <h1 className="text-[14px] font-semibold leading-5">Page not found</h1>
      <p className="typo-helper">The requested admin screen does not exist.</p>
      <TextLink href={adminPath()}>Back to dashboard</TextLink>
    </div>
  );
}
