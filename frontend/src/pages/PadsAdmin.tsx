import { Link } from "react-router-dom";
import PageLayout from "../components/Layout/PageLayout";
import PageHeader from "../components/Layout/PageHeader";
import Button from "../components/UI/Button";
import ErrorState from "../components/UI/ErrorState";
import EmptyState from "../components/UI/EmptyState";
import TableSkeleton from "../components/UI/TableSkeleton";
import ConfirmActionDialog from "../components/Turma/ConfirmActionDialog";
import {
  blockPadSource,
  deletePadAsAdmin,
  getRecentPadsForAdmin,
  unblockPadSource,
} from "../api/padsService";
import useDocumentTitle from "../hooks/useDocumentTitle";
import { useLoadOnce } from "../hooks/useLoadOnce";
import { useConfirmAction } from "../hooks/useConfirmAction";
import { useI18n } from "../i18n/useI18n";
import { formatDateTime } from "../lib/timeFormat";
import { adminUserPath, padPath } from "../lib/appLinks";

// Primeiros caracteres do hash do IP: chegam para ver a mesma origem em
// varios pads (o hash inteiro fica no title).
const ANON_HASH_SHOWN = 8;

// Moderacao de pads (admin): os alterados mais recentemente, quem gravou por
// ultimo e apagar. Cada apagar fica no security log.
export default function PadsAdmin() {
  const { t } = useI18n();
  useDocumentTitle(t("nav.admin.pads"));
  const { data, isLoading, error, reload } = useLoadOnce(getRecentPadsForAdmin);
  const confirm = useConfirmAction(t("turma.actionError"));

  return (
    <PageLayout>
      <PageHeader
        title={t("nav.admin.pads")}
        description={t("pad.admin.description")}
      />
      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={t("pad.loadError")} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t("pad.admin.none")} />
      ) : (
        <ul className="space-y-2">
          {data.map((pad) => (
            <li
              key={pad.slug}
              className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
            >
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={padPath(pad.slug)}
                  className="font-mono text-sm font-semibold text-violet-400 hover:underline"
                >
                  /pad/{pad.slug}
                </Link>
                <span className="flex gap-2">
                  {pad.updatedByIpHash && !pad.updatedBy && (
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-xs"
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
                    className="px-2.5 py-1 text-xs"
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
                {t("pad.admin.length", { count: pad.length.toLocaleString() })}{" "}
                · {formatDateTime(pad.updatedAt)} ·{" "}
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
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
