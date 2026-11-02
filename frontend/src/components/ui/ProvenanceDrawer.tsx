import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPlaceProvenanceAPI, PlaceProvenanceResponse } from '../../api/client';
import { VerificationBadge } from './Badge';
import {
  X,
  ShieldCheck,
  ExternalLink,
  Database,
  AlertCircle,
  Clock,
  Layers,
} from 'lucide-react';

interface ProvenanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  placeId: string | number | null;
  placeName?: string;
}

export const ProvenanceDrawer: React.FC<ProvenanceDrawerProps> = ({
  isOpen,
  onClose,
  placeId,
  placeName,
}) => {
  const {
    data: provenance,
    isLoading,
    isError,
    error,
  } = useQuery<PlaceProvenanceResponse>({
    queryKey: ['placeProvenance', placeId],
    queryFn: () => fetchPlaceProvenanceAPI(placeId!),
    enabled: isOpen && !!placeId,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden no-print">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-stone-900 border-l border-stone-800 text-white flex flex-col shadow-2xl animate-fade-in">
          {/* Header */}
          <div className="p-6 border-b border-stone-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>DATA PROVENANCE & FACT AUDIT</span>
              </div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {provenance?.placeName || placeName || 'Attraction Audit Trail'}
              </h2>
              <p className="text-xs text-stone-400">
                Audit log history of factual assertions, source URLs, and verification timestamps.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              title="Close audit drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-20 bg-stone-800/60 rounded-xl animate-pulse" />
                <div className="h-32 bg-stone-800/60 rounded-xl animate-pulse" />
                <div className="h-32 bg-stone-800/60 rounded-xl animate-pulse" />
              </div>
            ) : isError ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Provenance query failed</div>
                  <div className="text-[11px] text-red-400/90 mt-0.5">
                    {(error as Error)?.message || 'Could not retrieve data provenance logs for this attraction.'}
                  </div>
                </div>
              </div>
            ) : provenance ? (
              <div className="space-y-6">
                {/* Place Overview Card */}
                <div className="p-4 rounded-xl bg-stone-800/60 border border-stone-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-300">
                      Overall Verification Status:
                    </span>
                    <VerificationBadge status={provenance.verificationStatus as any} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-stone-700/50 text-xs">
                    <div>
                      <span className="text-stone-400 text-[11px] block">Primary Source</span>
                      <span className="font-semibold text-stone-200">
                        {provenance.dataSource || 'OpenStreetMap & Regional Records'}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[11px] block">Audit Records</span>
                      <span className="font-semibold text-emerald-400">
                        {provenance.count} recorded assertion{provenance.count === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {provenance.sourceUrl && (
                    <div className="pt-2 border-t border-stone-700/50 text-xs">
                      <span className="text-stone-400 text-[11px] block mb-1">Primary Source URL</span>
                      <a
                        href={provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-brand-saffron hover:underline text-xs break-all"
                      >
                        <span>{provenance.sourceUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Audit Assertions Timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Factual Audit History ({provenance.records.length})</span>
                    </h3>
                  </div>

                  {provenance.records.length === 0 ? (
                    <div className="p-6 rounded-xl bg-stone-800/30 border border-dashed border-stone-700 text-center text-stone-400 text-xs space-y-1">
                      <p className="font-medium text-stone-300">No individual field audit logs found.</p>
                      <p className="text-[11px] text-stone-500">
                        This place relies on primary dataset provenance.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {provenance.records.map((record) => {
                        const hasUrl =
                          record.source_url &&
                          (record.source_url.startsWith('http://') || record.source_url.startsWith('https://'));

                        return (
                          <div
                            key={record.id}
                            className="p-4 rounded-xl bg-stone-800/70 border border-stone-700/80 space-y-2.5 text-xs hover:border-emerald-500/40 transition-colors"
                          >
                            {/* Field Name & Status */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-brand-saffron bg-brand-saffron/10 px-2 py-0.5 rounded border border-brand-saffron/20">
                                {record.field_name}
                              </span>
                              <VerificationBadge status={record.verification_status as any} />
                            </div>

                            {/* Claimed Value */}
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-stone-400 uppercase font-semibold">
                                Claimed Factual Value:
                              </span>
                              <div className="font-semibold text-white bg-stone-900/80 p-2 rounded-lg border border-stone-800">
                                {record.claimed_value || 'None specified'}
                              </div>
                            </div>

                            {/* Evidence Notes */}
                            {record.evidence_notes && (
                              <div className="text-[11px] text-stone-300 italic bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                                {record.evidence_notes}
                              </div>
                            )}

                            {/* Source and URL */}
                            <div className="pt-2 border-t border-stone-700/60 flex flex-col gap-1 text-[11px] text-stone-400">
                              <div className="flex items-center gap-1.5">
                                <Database className="w-3 h-3 text-stone-500" />
                                <span>Source: <strong className="text-stone-300">{record.source_name}</strong></span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <ExternalLink className="w-3 h-3 text-stone-500 shrink-0" />
                                {hasUrl ? (
                                  <a
                                    href={record.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:underline break-all"
                                  >
                                    {record.source_url}
                                  </a>
                                ) : (
                                  <span className="text-stone-500 italic">
                                    Source URL not recorded
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[10px] text-stone-500 pt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Logged: {new Date(record.retrieved_at).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
            <span>LOCAL LENS INDIA Provenance Standard</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
