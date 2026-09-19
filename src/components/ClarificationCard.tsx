import React from 'react';
import { HelpCircle, ChevronRight, Sparkles, CheckCircle2, Table2 } from 'lucide-react';
import { ClarificationRequest, ClarificationOption } from '../types';

interface ClarificationCardProps {
  clarification: ClarificationRequest;
  onSelectOption: (option: ClarificationOption) => void;
  selectedOptionId?: string;
  disabled?: boolean;
}

export const ClarificationCard: React.FC<ClarificationCardProps> = ({
  clarification,
  onSelectOption,
  selectedOptionId,
  disabled = false,
}) => {
  return (
    <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-4 my-3 text-stone-900 shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-6 h-6 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0 mt-0.5">
          <HelpCircle className="w-3.5 h-3.5 text-amber-900" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Clarification Needed
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
              {clarification.ambiguityType?.replace(/_/g, ' ') || 'SCHEMA AMBIGUITY'}
            </span>
            <span className="text-[10px] text-amber-700">
              Confidence: {Math.round(clarification.confidenceScore * 100)}%
            </span>
          </div>
          <p className="text-xs text-stone-800 font-medium mt-1">
            {clarification.question}
          </p>
        </div>
      </div>

      {/* Disambiguation Choices */}
      <div className="space-y-2 mt-3 pl-8">
        {clarification.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          return (
            <button
              key={option.id}
              disabled={disabled}
              onClick={() => onSelectOption(option)}
              className={`w-full text-left p-3 rounded-md border text-xs transition-all flex items-start justify-between ${
                isSelected
                  ? 'bg-amber-100 border-amber-500 shadow-sm ring-1 ring-amber-500'
                  : 'bg-white hover:bg-stone-50 border-stone-200 hover:border-amber-300'
              } ${disabled && !isSelected ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900">
                    {option.label}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      <CheckCircle2 className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  {option.description}
                </p>
                {option.targetColumn && (
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-stone-500">
                    <span className="bg-stone-100 px-1.5 py-0.5 rounded">
                      Target: {option.targetTable ? `${option.targetTable}.` : ''}{option.targetColumn}
                    </span>
                    {option.exampleValue && (
                      <span className="text-stone-400">
                        Example: {option.exampleValue}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ChevronRight className={`w-4 h-4 mt-0.5 ${isSelected ? 'text-amber-700' : 'text-stone-400'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};
