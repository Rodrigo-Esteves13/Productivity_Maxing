import { Link } from "react-router-dom";
import PageLayout from "../components/Layout/PageLayout";
import PageHeader from "../components/Layout/PageHeader";
import Button from "../components/UI/Button";
import ErrorState from "../components/UI/ErrorState";
import EmptyState from "../components/UI/EmptyState";
import SearchField from "../components/UI/SearchField";
import Pagination from "../components/UI/Pagination";
import BlockedPadSources from "../components/PadsAdmin/BlockedPadSources";
import TableSkeleton from "../components/UI/TableSkeleton";
import ConfirmActionDialog from "../components/Turma/ConfirmActionDialog";
import {
  blockPadSource,
  deletePadAsAdmin,
  unblockPadSource,
} from "../api/padsService";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { usePadsAdmin } from "../hooks/usePadsAdmin";
import { useConfirmAction } from "../hooks/useConfirmAction";
import { useI18n } from "../i18n/useI18n";
import { formatDateTime } from "../lib/timeFormat";
import { adminUserPath, padPath } from "../lib/appLinks";
import { PAD_SLUG_MAX_LENGTH } from "../lib/padSlug";

// Primeiros caracteres do hash do IP: chegam para ver a mesma origem em
// varios pads (o hash inteiro fica no title).
const ANON_HASH_SHOWN = 8;

// Moderacao de pads (admin): todos os pads (mais recentes primeiro), quem
// gravou por ultimo, origens bloqueadas e apagar. Cada apagar fica no
// security log.
export default function PadsAdmin() {
  const { t, lang } = useI18n();
  useDocumentTitle(t("nav.admin.pads"));
  const {
    pads,
    blocked,
    query,
    setQuery,
    search,
    skip,
    setSkip,
    blockedSkip,
    setBlockedSkip,
    pageSize,
    reload,
  } = usePadsAdmin();
  const confirm = useConfirmAction(t("turma.actionError"));

  const requestUnblock = (ipHash: string) =>
    confirm.request({
      title: t("pad.admin.unblock"),
      message: t("pad.admin.unblockConfirm"),
      confirmLabel: t("pad.admin.unblock"),
      tone: "default",
      run: async () => {
        await unblockPadSource(ipHash);
        reload();
      },
    });

  return (
    <PageLayout>
      <PageHeader
        title={t("nav.admin.pads")}
        description={t("pad.admin.description")}
      />
      <BlockedPadSources
        sources={blocked}
        skip={blockedSkip}
        pageSize={pageSize}
        onSkipChange={setBlockedSkip}
        onUnblock={requestUnblock}
      />
      {pads.isLoading ? (
        <TableSkeleton />
      ) : pads.hasError || !pads.data ? (
        <ErrorState message={t("pad.loadError")} onRetry={reload} />
      ) : !search && pads.data.total === 0 ? (
        <EmptyState message={t("pad.admin.none")} />
      ) : (
        <>
          <div className="mb-3">
            <SearchField
              value={query}
              onChange={(value) => setQuery(value.slice(0, PAD_SLUG_MAX_LENGTH))}
              label={t("ux4adm2.pads.search")}
            />
          </div>
          {pads.data.items.length === 0 ? (
            <EmptyState message={t("search.noResultsFor", { query: search })} />
          ) : (
        <ul className="space-y-2">
          {pads.data.items.map((pad) => (
            <li
              key={pad.slug}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={padPath(pad.slug)}
                  className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center font-mono text-sm font-semibold text-violet-400 hover:underline"
                >
                  /pad/{pad.slug}
                </Link>
                <span className="flex gap-2">
                  {pad.updatedByIpHash && !pad.updatedBy && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const ipHash = pad.updatedByIpHash as string;
                        confirm.request({
                          title: t(
                            pad.sourceBlocked
                              ? "pad.admin.unblock"
                              : "pad.admin.block",
                          ),
                          message: t(
                            pad.sourceBlocked
                              ? "pad.admin.unblockConfirm"
                              : "pad.admin.blockConfirm",
                          ),
                          confirmLabel: t(
                            pad.sourceBlocked
                              ? "pad.admin.unblock"
                              : "pad.admin.block",
                          ),
                          tone: pad.sourceBlocked ? "default" : "danger",
                          run: async () => {
                            await (pad.sourceBlocked
                              ? unblockPadSource(ipHash)
                              : blockPadSource(ipHash));
                            reload();
                          },
                        });
                      }}
                    >
                      {t(
                        pad.sourceBlocked
                          ? "pad.admin.unblock"
                          : "pad.admin.block",
                      )}
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() =>
                      confirm.request({
                        title: t("pad.admin.delete"),
                        message: t("pad.admin.deleteConfirm", {
                          name: pad.slug,
                        }),
                        confirmLabel: t("common.delete"),
                        tone: "danger",
                        run: async () => {
                          await deletePadAsAdmin(pad.slug);
                          reload();
                        },
                      })
                    }
                  >
                    {t("pad.admin.delete")}
                  </Button>
                </span>
              </div>
              <p className="mb-2 line-clamp-3 whitespace-pre-wrap break-words font-mono text-xs text-neutral-400">
                {pad.preview || t("pad.admin.empty")}
              </p>
              <p className="text-xs text-neutral-500">
                {t("pad.admin.length", { count: pad.length.toLocaleString(lang) })}{" "}
                · {formatDateTime(pad.updatedAt, lang)} ·{" "}
                {pad.updatedBy ? (
                  <Link
                    to={adminUserPath(pad.updatedBy.id)}
                    className="hover:underline"
                  >
                    {pad.updatedBy.name ?? pad.updatedBy.email}
                  </Link>
                ) : pad.updatedByIpHash ? (
                  <span title={pad.updatedByIpHash}>
                    {t("pad.admin.anonymous", {
                      hash: pad.updatedByIpHash.slice(0, ANON_HASH_SHOWN),
                    })}
                  </span>
                ) : (
                  t("pad.admin.deletedUser")
                )}
                {pad.lockedBy && (
                  <>
                    {" "}
                    ·{" "}
                    {t("pad.admin.lockedBy", {
                      name: pad.lockedBy.name ?? pad.lockedBy.email,
                    })}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
          )}
          <Pagination
            total={pads.data.total}
            skip={skip}
            pageSize={pageSize}
            onNextPage={() => setSkip(skip + pageSize)}
            onPrevPage={() => setSkip(Math.max(0, skip - pageSize))}
          />
        </>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
