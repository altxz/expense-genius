import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelectedDate } from '@/contexts/DateContext';

export function MonthSelector() {
  const { label, goToPrevMonth, goToNextMonth } = useSelectedDate();

  return (
    <div className="flex items-center justify-center gap-2">
      <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="rounded-xl h-9 w-9">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <span className="text-sm sm:text-base font-semibold capitalize min-w-[140px] text-center">
        {label}
      </span>
      <Button variant="ghost" size="icon" onClick={goToNextMonth} className="rounded-xl h-9 w-9">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
