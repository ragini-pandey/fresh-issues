import { AlertTriangle, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function StatusBar({ rateLimit, newCount, loading }) {
  const isLowRateLimit = rateLimit.remaining !== null && rateLimit.remaining < 10;
  const resetTime = rateLimit.reset ? new Date(rateLimit.reset).toLocaleTimeString() : null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground shrink-0">
      {loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 animate-pulse">
          <Activity size={12} />
          <span className="hidden sm:inline">Fetching</span>
        </div>
      )}
      {newCount > 0 && (
        <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold px-1.5 py-0 animate-fade-in">
          +{newCount} new
        </Badge>
      )}
      {rateLimit.remaining !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`text-[10px] font-mono tabular-nums hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${
              rateLimit.remaining === 0 ? 'text-destructive bg-destructive/10 font-bold' :
              rateLimit.remaining < 5 ? 'text-orange-600 dark:text-orange-500 bg-orange-500/10 font-semibold' : 
              'text-muted-foreground/60'
            }`}>
              {isLowRateLimit && rateLimit.remaining > 0 && <AlertTriangle size={10} />}
              {rateLimit.remaining}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {rateLimit.remaining === 0 
                ? `Rate limit exhausted. Resets at ${resetTime}`
                : isLowRateLimit 
                ? `Running low on API requests. Resets at ${resetTime}`
                : `${rateLimit.remaining} API requests remaining`}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
