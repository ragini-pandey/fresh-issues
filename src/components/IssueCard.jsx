import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function IssueCard({ issue, isNew, index = 0 }) {
  const timeAgo = formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true });
  const owner = issue.repoFullName.split('/')[0];

  return (
    <div
      className={`group relative rounded-xl border bg-card overflow-hidden cursor-pointer
        transition-all duration-300 ease-in-out
        hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:-translate-y-0.5
        ${isNew ? 'border-primary/30 bg-primary/[0.03] animate-pulse-green' : 'border-border hover:border-border-light'}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Collapsed view — always visible */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Avatar className="size-6 rounded-md shrink-0">
          <AvatarImage src={`https://github.com/${owner}.png?size=32`} />
          <AvatarFallback className="rounded-md text-[8px]">{owner.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-muted-foreground font-mono truncate">{issue.repoFullName}</span>
            <span className="text-[11px] text-muted-foreground/40 font-mono shrink-0">#{issue.number}</span>
          </div>
          <p className="text-sm font-medium text-foreground/90 truncate leading-snug mt-0.5">
            {issue.title}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 text-xs text-muted-foreground">
          {issue.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={11} />{issue.comments}
            </span>
          )}
          <span className="hidden sm:block text-muted-foreground/40 text-[11px] whitespace-nowrap">{timeAgo}</span>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all no-underline shrink-0"
          >
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      {/* Expanded details — revealed on hover */}
      <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-all duration-300 ease-in-out">
        <div className="overflow-hidden">
          <div className="px-4 pb-3 pt-0 border-t border-border/50">
            {/* Body preview */}
            {issue.body && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-2.5 mb-2.5 line-clamp-2">
                {issue.body}
              </p>
            )}

            {/* Labels */}
            {issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {issue.labels.map((label) => (
                  <Badge
                    key={label.name}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 font-medium"
                    style={{
                      backgroundColor: `#${label.color}12`,
                      color: `#${label.color}`,
                      borderColor: `#${label.color}25`,
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Footer meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-primary/60" />
                {timeAgo}
              </span>
              {issue.reactions > 0 && (
                <span className="flex items-center gap-1">
                  <Heart size={10} />{issue.reactions}
                </span>
              )}
              <a
                href={issue.user.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors no-underline"
              >
                <Avatar className="size-4">
                  <AvatarImage src={issue.user.avatar} alt={issue.user.login} />
                  <AvatarFallback className="text-[6px]">{issue.user.login.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{issue.user.login}</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
