import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCircle2, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useKieData } from "@/lib/useKieData";
import { buildNotifications, unseenCount, markAllSeen } from "@/lib/notifications";

const DOT = {
  critical: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const GROUP_LABEL = {
  critical: "Act today",
  warning: "Needs attention",
  info: "For your information",
};

// Bell button + popover. Notifications are derived live from real records
// (no notification table) — every row deep-links to the thing itself.
export default function NotificationCenter() {
  const data = useKieData();
  const [open, setOpen] = useState(false);
  const items = useMemo(() => buildNotifications(data), [data]);
  const [unseen, setUnseen] = useState(() => unseenCount(items));

  React.useEffect(() => {
    setUnseen(unseenCount(items));
  }, [items]);

  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) {
      markAllSeen(items);
      setUnseen(0);
    }
  };

  const groups = ["critical", "warning", "info"]
    .map((sev) => ({ sev, rows: items.filter((i) => i.severity === sev) }))
    .filter((g) => g.rows.length > 0);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unseen ? ` — ${unseen} new` : ""}`}
          className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unseen > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[calc(100vw-2rem)] sm:w-96 p-0 overflow-hidden"
      >
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {items.length} open item{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-10 px-6 text-center">
              <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nothing needs your attention right now.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.sev}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
                  {GROUP_LABEL[g.sev]}
                </p>
                {g.rows.map((n) => (
                  <Link
                    key={n.id}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted transition-colors"
                  >
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[n.severity]}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">
                        {n.title}
                      </span>
                      {n.sub && (
                        <span className="block text-xs text-muted-foreground truncate">
                          {n.sub}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}