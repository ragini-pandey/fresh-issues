import { RefreshCw, Circle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function StatusBar({ rateLimit, autoRefresh, newCount, onRefresh, loading }) {
  const isLowRateLimit = rateLimit.remaining !== null && rateLimit.remaining < 10;
  const resetTime = rateLimit.reset ? new Date(rateLimit.reset).toLocaleTimeString() : null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5 text-sm text-muted-foreground shrink-0">
      {autoRefresh && (
        <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-xs sm:text-sm gap-1 sm:gap-1.5 py-0.5 hidden sm:flex">
          <Circle size={6} className="fill-primary" /> Live
        </Badge>
      )}
      {newCount > 0 && (
        <Badge variant="outline" className="border-primary/20 bg-primary/8 text-primary text-xs sm:text-sm py-0.5 animate-fade-in">
          +{newCount}
        </Badge>
      )}
      {rateLimit.remaining !== null && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`text-xs sm:text-sm font-mono tabular-nums hidden sm:inline flex items-center gap-1 ${
              rateLimit.remaining === 0 ? 'text-destructive font-bold' :
              rateLimit.remaining < 5 ? 'text-orange-600 dark:text-orange-500 font-semibold' : 
              'text-muted-foreground/70'
            }`}>
              {isLowRateLimit && rateLimit.remaining > 0 && <AlertTriangle size={12} />}
              {rateLimit.remaining} req
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
      <Button
        onClick={onRefresh}
        disabled={loading}
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-primary cursor-pointer"
        title="Refresh now"
      >
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
      </Button>
    </div>
  );
}
