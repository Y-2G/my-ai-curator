import { cn } from '@/lib/utils/cn';

interface InterestScoreProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function InterestScore({ score, showLabel = false, size = 'md' }: InterestScoreProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const maxStars = 5;
  const filledStars = Math.round((score / 10) * maxStars);

  return (
    <div className={cn('flex items-center gap-1', sizeClasses[size])}>
      {showLabel && (
        <span className="text-gray-600 dark:text-gray-400 mr-1">興味度:</span>
      )}
      <div className="flex items-center">
        {[...Array(maxStars)].map((_, i) => (
          <svg
            key={i}
            className={cn(
              'w-4 h-4',
              i < filledStars ? getScoreColor(score) : 'text-gray-300 dark:text-gray-600'
            )}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className={cn('ml-1 font-medium', getScoreColor(score))}>
        {score}/10
      </span>
    </div>
  );
}