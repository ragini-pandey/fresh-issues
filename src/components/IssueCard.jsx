import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, ArrowUpRight } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function IssueCard({ issue, isNew, index = 0 }) {
  const timeAgo = formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true });
  const owner = issue.repoFullName.split('/')[0];

  return (
    <a
      href={issue.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-xl border bg-card overflow-hidden
        transition-all duration-200 ease-in-out no-underline
        hover:shadow-md hover:shadow-black/[0.04] dark:hover:shadow-black/20 hover:-translate-y-px
        ${isNew ? 'border-secondary bg-secondary/10 animate-pulse-green' : 'border-border hover:border-border-light'}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="p-4">
        {/* Top row: repo info + time */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="size-5 rounded-md shrink-0">
              <AvatarImage src={`https://github.com/${owner}.png?size=32`} />
              <AvatarFallback className="rounded-md text-[8px] font-medium">{owner.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{issue.repoFullName}</span>
            <span className="text-[11px] text-muted-foreground/40 font-mono shrink-0">#{issue.number}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap hidden sm:block">{timeAgo}</span>
            <ArrowUpRight size={14} className="text-muted-foreground/30 group-hover:text-foreground transition-colors shrink-0" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-medium text-foreground leading-snug mb-2 line-clamp-2 group-hover:text-foreground/90">
          {issue.title}
        </h3>

        {/* Body preview */}
        {issue.body && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
            {issue.body}
          </p>
        )}

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {issue.labels.slice(0, 4).map((label) => (
              <span
                key={label.name}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `#${label.color}18`,
                  color: `#${label.color}`,
                }}
              >
                {label.name}
              </span>
            ))}
            {issue.labels.length > 4 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-muted-foreground bg-muted">
                +{issue.labels.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Bottom meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="sm:hidden text-muted-foreground/60">{timeAgo}</span>
          {issue.reactions > 0 && (
            <span className="flex items-center gap-1">
              <Heart size={11} />
              {issue.reactions}
            </span>
          )}
          {issue.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={11} />
              {issue.comments}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <Avatar className="size-4">
              <AvatarImage src={issue.user.avatar} alt={issue.user.login} />
              <AvatarFallback className="text-[6px]">{issue.user.login.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground/70">{issue.user.login}</span>
          </span>
        </div>
      </div>
    </a>
  );
}
