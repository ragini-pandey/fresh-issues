import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Heart, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function IssueCard({ issue, isNew, index = 0 }) {
  const timeAgo = formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true });

  return (
    <Card
      className={`group relative transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 ${
        isNew
          ? 'border-primary/30 bg-primary/[0.03] animate-pulse-green'
          : 'hover:border-border-light hover:bg-surface-hover'
      }`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {isNew && (
        <div className="absolute -top-2 right-4 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider shadow-[0_2px_8px_rgba(80,250,123,0.3)]">
          NEW
        </div>
      )}

      <CardContent className="p-3 sm:p-5 pb-0">
        {/* Repo Name */}
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="size-5 rounded-md shrink-0">
              <AvatarImage src={`https://github.com/${issue.repoFullName.split('/')[0]}.png?size=32`} />
              <AvatarFallback className="rounded-md text-[8px]">{issue.repoFullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <a
              href={`https://github.com/${issue.repoFullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm sm:text-base font-bold text-foreground hover:text-primary transition-colors no-underline truncate"
            >
              {issue.repoFullName}
            </a>
            <span className="text-xs text-muted-foreground font-mono shrink-0 hidden sm:inline">#{issue.number}</span>
          </div>
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 hover:text-primary hover:bg-primary/10 transition-all no-underline"
            title="Open on GitHub"
          >
            <ArrowUpRight size={14} />
          </a>
        </div>

        {/* Issue Title */}
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm sm:text-base font-medium text-foreground/90 hover:text-primary leading-snug mb-2 no-underline transition-colors"
        >
          {issue.title}
        </a>

        {/* Body Preview */}
        {issue.body && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-2">
            {issue.body}
          </p>
        )}

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {issue.labels.map((label) => (
              <Badge
                key={label.name}
                variant="outline"
                className="text-[11px] px-2 py-0.5 font-medium"
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
      </CardContent>

      {/* Metadata Footer */}
      <CardFooter className="flex items-center flex-wrap gap-x-4 gap-y-1 px-3 sm:px-5 py-2 sm:py-3 border-t border-border/60 bg-background/30 rounded-b-xl text-xs sm:text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5" title="Opened">
          <span className="size-1 rounded-full bg-primary/60" />
          {timeAgo}
        </span>
        {issue.comments > 0 && (
          <span className="flex items-center gap-1" title="Comments">
            <MessageSquare size={11} /> {issue.comments}
          </span>
        )}
        {issue.reactions > 0 && (
          <span className="flex items-center gap-1" title="Reactions">
            <Heart size={11} /> {issue.reactions}
          </span>
        )}
        <a
          href={issue.user.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors no-underline"
          title={issue.user.login}
        >
          <Avatar className="size-4">
            <AvatarImage src={issue.user.avatar} alt={issue.user.login} />
            <AvatarFallback className="text-[6px]">{issue.user.login.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-xs">{issue.user.login}</span>
        </a>
      </CardFooter>
    </Card>
  );
}
