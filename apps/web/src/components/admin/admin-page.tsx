"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import {
  exportSupportUserData,
  importSupportUserData,
  listSupportUserAccounts,
  unlinkSupportUserAccount,
  type SupportCompanyExportPayload
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { ToastOverlay } from "@/components/ui/toast-manager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, ShieldAlert, UserCircle, RefreshCw, Ban, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-manager";

interface UserData {
  id: string;
  email: string;
  name: string;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
  emailVerified: boolean;
}

interface SupportAccount {
  id: string;
  providerId: string;
  accountId: string;
  createdAt: string;
}

const MAIN_ADMIN_EMAIL = "admin@corpsim.local";
export function AdminPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [supportUser, setSupportUser] = useState<UserData | null>(null);
  const [supportAccounts, setSupportAccounts] = useState<SupportAccount[]>([]);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [isSupportLoading, setSupportLoading] = useState(false);
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string | null>(null);
  const [isSupportStatusLoading, setSupportStatusLoading] = useState(false);
  const [isDeletingSupportUser, setDeletingSupportUser] = useState(false);
  const [exportingSupportData, setExportingSupportData] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importingSupportData, setImportingSupportData] = useState(false);
  const [isRemovingAdmin, setRemovingAdmin] = useState<string | null>(null);
  const { showToast, confirmPopup } = useToast();
  const { data: session } = authClient.useSession();

  const isSupportOpen = useMemo(() => Boolean(supportUser), [supportUser]);
  const isMainAdmin = session?.user?.email?.toLowerCase() === MAIN_ADMIN_EMAIL;

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await authClient.admin.listUsers({
        query: {
          limit: 100,
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      });

      if (result.data) {
        setUsers(result.data.users as unknown as UserData[]);
      } else if (result.error) {
        showToast({
          title: "Failed to load users",
          description: result.error.message || "Unknown error",
          variant: "error",
        });
      }
    } catch (error) {
      showToast({
        title: "Error loading users",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleMakeAdmin = async (userId: string) => {
    setActionLoading(`role-${userId}`);
    try {
      const result = await authClient.admin.setRole({
        userId,
        role: "admin",
      });

      if (result.error) {
        showToast({
          title: "Failed to update role",
          description: result.error.message || "Unknown error",
          variant: "error",
        });
      } else {
        showToast({
          title: "Role updated",
          description: "User role set to admin",
          variant: "success",
        });
        await loadUsers();
      }
    } catch (error) {
      showToast({
        title: "Error updating role",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBan = async (userId: string, currentBanned: boolean) => {
    setActionLoading(`ban-${userId}`);
    try {
      if (currentBanned) {
        const result = await authClient.admin.unbanUser({ userId });
        if (result.error) {
          showToast({
            title: "Failed to unban user",
            description: result.error.message || "Unknown error",
            variant: "error",
          });
        } else {
          showToast({
            title: "User unbanned",
            description: "User can now sign in",
            variant: "success",
          });
          await loadUsers();
        }
      } else {
        const result = await authClient.admin.banUser({
          userId,
          banReason: "Banned by administrator",
        });
        if (result.error) {
          showToast({
            title: "Failed to ban user",
            description: result.error.message || "Unknown error",
            variant: "error",
          });
        } else {
          showToast({
            title: "User banned",
            description: "User can no longer sign in",
            variant: "success",
          });
          await loadUsers();
        }
      }
    } catch (error) {
      showToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAllSessions = async (userId: string) => {
    setActionLoading(`revoke-${userId}`);
    try {
      const result = await authClient.admin.revokeUserSessions({ userId });
      if (result.error) {
        showToast({
          title: "Failed to revoke sessions",
          description: result.error.message || "Unknown error",
          variant: "error",
        });
      } else {
        showToast({
          title: "Sessions revoked",
          description: "All user sessions have been terminated",
          variant: "success",
        });
      }
    } catch (error) {
      showToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const loadSupportAccounts = useCallback(
    async (userId: string) => {
      setSupportLoading(true);
      setSupportError(null);
      try {
        const accounts = await listSupportUserAccounts(userId);
        setSupportAccounts(accounts);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load linked accounts.";
        setSupportError(message);
        showToast({
          title: "Failed to load linked accounts",
          description: message,
          variant: "error"
        });
      } finally {
        setSupportLoading(false);
      }
    },
    [showToast]
  );

  const handleOpenSupport = useCallback(
    async (user: UserData) => {
      setSupportUser(user);
      setSupportAccounts([]);
      await loadSupportAccounts(user.id);
    },
    [loadSupportAccounts]
  );

  const handleCloseSupport = useCallback(() => {
    setSupportUser(null);
    setSupportAccounts([]);
    setSupportError(null);
    setUnlinkingAccountId(null);
    setImportFile(null);
  }, []);

  const handleUnlinkAccount = useCallback(
    async (accountId: string) => {
      if (!supportUser) {
        return;
      }

      setUnlinkingAccountId(accountId);
      try {
        await unlinkSupportUserAccount(supportUser.id, accountId);
        showToast({
          title: "Account unlinked",
          description: "The account has been disconnected.",
          variant: "success"
        });
        await loadSupportAccounts(supportUser.id);
      } catch (error) {
        showToast({
          title: "Failed to unlink account",
          description: error instanceof Error ? error.message : "Unable to unlink the account.",
          variant: "error"
        });
      } finally {
        setUnlinkingAccountId(null);
      }
    },
    [loadSupportAccounts, showToast, supportUser]
  );

  const handleUnbanSupportUser = useCallback(async () => {
    if (!supportUser) {
      return;
    }

    setSupportStatusLoading(true);
    try {
      const result = await authClient.admin.unbanUser({ userId: supportUser.id });
      if (result.error) {
        showToast({
          title: "Failed to unban user",
          description: result.error.message || "Unknown error",
          variant: "error"
        });
        return;
      }

      showToast({
        title: "User unbanned",
        description: "User can now sign in.",
        variant: "success"
      });
      setSupportUser((current) =>
        current ? { ...current, banned: false, banReason: null } : current
      );
      await loadUsers();
    } catch (error) {
      showToast({
        title: "Failed to unban user",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setSupportStatusLoading(false);
    }
  }, [loadUsers, showToast, supportUser]);

  const handleExportSupportData = useCallback(async () => {
    if (!supportUser) {
      return;
    }

    setExportingSupportData(true);
    try {
      const payload = await exportSupportUserData(supportUser.id);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeEmail = supportUser.email.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const fileName = `corpsim-export-${safeEmail || supportUser.id}-${timestamp}.json`;
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json"
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      showToast({
        title: "Export ready",
        description: `Downloaded ${fileName}.`,
        variant: "success"
      });
    } catch (error) {
      showToast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unable to export data.",
        variant: "error"
      });
    } finally {
      setExportingSupportData(false);
    }
  }, [showToast, supportUser]);

  const handleImportSupportData = useCallback(async () => {
    if (!supportUser) {
      return;
    }

    if (!importFile) {
      showToast({
        title: "File required",
        description: "Select a support export file to import.",
        variant: "error"
      });
      return;
    }

    const confirmed = await confirmPopup({
      title: "Import data to this account?",
      description:
        "This overwrites the user's company data with the selected export file. Make sure the file is current.",
      confirmLabel: "Import data",
      cancelLabel: "Cancel",
      variant: "danger"
    });

    if (!confirmed) {
      return;
    }

    setImportingSupportData(true);
    try {
      let payload: SupportCompanyExportPayload;
      try {
        const text = await importFile.text();
        payload = JSON.parse(text) as SupportCompanyExportPayload;
      } catch (parseError) {
        throw new Error("Unable to read the export file. Make sure it is valid JSON.");
      }

      await importSupportUserData({
        targetUserId: supportUser.id,
        payload
      });

      showToast({
        title: "Import complete",
        description: "The export data has been applied.",
        variant: "success"
      });
      setImportFile(null);
      await loadUsers();
    } catch (error) {
      showToast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unable to import data.",
        variant: "error"
      });
    } finally {
      setImportingSupportData(false);
    }
  }, [confirmPopup, importFile, loadUsers, showToast, supportUser]);

  const handleRemoveAdmin = useCallback(
    async (user: UserData) => {
      const confirmed = await confirmPopup({
        title: "Remove admin role?",
        description: `Remove admin privileges from ${user.email}?`,
        confirmLabel: "Remove admin",
        cancelLabel: "Cancel",
        variant: "danger"
      });

      if (!confirmed) {
        return;
      }

      setRemovingAdmin(user.id);
      try {
        const result = await authClient.admin.setRole({
          userId: user.id,
          role: "user"
        });

        if (result.error) {
          showToast({
            title: "Failed to update role",
            description: result.error.message || "Unknown error",
            variant: "error"
          });
        } else {
          showToast({
            title: "Admin removed",
            description: "User is no longer an admin.",
            variant: "success"
          });
          await loadUsers();
        }
      } catch (error) {
        showToast({
          title: "Failed to update role",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "error"
        });
      } finally {
        setRemovingAdmin(null);
      }
    },
    [confirmPopup, loadUsers, showToast]
  );

  const handleDeleteSupportUser = useCallback(async () => {
    if (!supportUser) {
      return;
    }

    const confirmed = await confirmPopup({
      title: "Delete user account?",
      description:
        "This permanently removes the user and all linked accounts. This action cannot be undone.",
      confirmLabel: "Delete account",
      cancelLabel: "Cancel",
      variant: "danger"
    });

    if (!confirmed) {
      return;
    }

    setDeletingSupportUser(true);
    try {
      const result = await authClient.admin.removeUser({ userId: supportUser.id });
      if (result.error) {
        showToast({
          title: "Failed to delete user",
          description: result.error.message || "Unknown error",
          variant: "error"
        });
        return;
      }

      showToast({
        title: "User deleted",
        description: "The account has been removed.",
        variant: "success"
      });
      handleCloseSupport();
      await loadUsers();
    } catch (error) {
      showToast({
        title: "Failed to delete user",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "error"
      });
    } finally {
      setDeletingSupportUser(false);
    }
  }, [confirmPopup, handleCloseSupport, loadUsers, showToast, supportUser]);

  const isAdmin = (role: string | null) => {
    if (!role) return false;
    return role.split(",").some((r) => r.trim().toLowerCase() === "admin");
  };

  return (
    <div className="flex flex-col gap-6 w-full p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Admin Dashboard
            </CardTitle>
            <CardDescription>Manage users and access control</CardDescription>
          </div>
          <Button onClick={loadUsers} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>
                        {isAdmin(user.role) ? (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="muted">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.banned ? (
                          <Badge variant="danger" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Banned
                          </Badge>
                        ) : user.emailVerified ? (
                          <Badge variant="success">
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            Unverified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenSupport(user)}
                            disabled={actionLoading !== null || isAdmin(user.role)}
                            title={
                              isAdmin(user.role)
                                ? "Cannot support admin users"
                                : "Open support overlay"
                            }
                          >
                            <UserCircle className="h-4 w-4" />
                            <span className="ml-2 text-xs">Support</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevokeAllSessions(user.id)}
                            disabled={actionLoading !== null}
                            title="Revoke all sessions"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleBan(user.id, user.banned || false)}
                            disabled={actionLoading !== null || isAdmin(user.role)}
                            title={
                              isAdmin(user.role)
                                ? "Cannot ban admin users"
                                : user.banned
                                  ? "Unban user"
                                  : "Ban user"
                            }
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                          {!isAdmin(user.role) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMakeAdmin(user.id)}
                              disabled={actionLoading !== null}
                              title="Make admin"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          {isMainAdmin && isAdmin(user.role) && user.email !== MAIN_ADMIN_EMAIL && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveAdmin(user)}
                              disabled={isRemovingAdmin === user.id}
                              title="Remove admin"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {users.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Users</div>
              <div className="text-2xl font-bold">{users.length}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Admins</div>
              <div className="text-2xl font-bold">{users.filter((u) => isAdmin(u.role)).length}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Verified</div>
              <div className="text-2xl font-bold">{users.filter((u) => u.emailVerified).length}</div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Banned</div>
              <div className="text-2xl font-bold">{users.filter((u) => u.banned).length}</div>
            </div>
          </CardContent>
        </Card>
      )}
      {isSupportOpen && supportUser ? (
        <ToastOverlay
          labelledBy="support-overlay-title"
          describedBy="support-overlay-description"
          onBackdropMouseDown={handleCloseSupport}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p id="support-overlay-title" className="text-lg font-semibold text-slate-100">
                  Support: {supportUser.email}
                </p>
                <p id="support-overlay-description" className="text-sm text-slate-300">
                  Manage linked accounts for this user without impersonation.
                </p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={handleCloseSupport}>
                Close
              </Button>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">Account Status</p>
                  <div className="mt-2 flex items-center gap-2">
                    {supportUser.banned ? (
                      <Badge variant="danger">Banned</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                    {supportUser.banReason ? (
                      <span className="text-xs text-muted-foreground">
                        Reason: {supportUser.banReason}
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleUnbanSupportUser}
                  disabled={!supportUser.banned || isSupportStatusLoading}
                  title={supportUser.banned ? "Unban user" : "User is not banned"}
                >
                  {isSupportStatusLoading ? "Unbanning..." : "Unban user"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteSupportUser}
                  disabled={isDeletingSupportUser}
                  className="text-red-300 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="ml-2 text-xs">
                    {isDeletingSupportUser ? "Deleting..." : "Delete account"}
                  </span>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-100">Linked Accounts</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => loadSupportAccounts(supportUser.id)}
                  disabled={isSupportLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isSupportLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>

              {supportError ? (
                <p className="mt-3 text-sm text-amber-300">{supportError}</p>
              ) : isSupportLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">Loading accounts...</p>
              ) : supportAccounts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No linked accounts found.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {supportAccounts.map((account) => {
                    const isCredential = account.providerId === "credential";
                    const isUnlinking = unlinkingAccountId === account.id;
                    return (
                      <div
                        key={account.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-100">
                            {account.providerId}
                          </p>
                          <p className="text-xs text-muted-foreground">{account.accountId}</p>
                          <p className="text-xs text-muted-foreground">
                            Linked {new Date(account.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUnlinkAccount(account.id)}
                          disabled={isCredential || isUnlinking}
                          title={
                            isCredential
                              ? "Credential accounts cannot be unlinked"
                              : "Unlink this account"
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="ml-2 text-xs">Unlink</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              <p className="text-sm font-semibold text-slate-100">Export / Import Data</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Export this user's company data to a local file, or import a recent export file
                back into this account.
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleExportSupportData}
                    disabled={exportingSupportData}
                  >
                    {exportingSupportData ? "Exporting..." : "Export data"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Downloads a JSON file for the selected user.
                  </span>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Import file (JSON)
                  </label>
                  <input
                    type="file"
                    accept="application/json"
                    className="mt-2 flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-sm file:mr-3 file:border-0 file:bg-transparent file:text-xs file:text-slate-200"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                  {importFile ? (
                    <p className="mt-2 text-xs text-muted-foreground">Selected: {importFile.name}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleImportSupportData}
                  disabled={importingSupportData || !importFile}
                >
                  {importingSupportData ? "Importing..." : "Import data"}
                </Button>
              </div>
            </div>
          </div>
        </ToastOverlay>
      ) : null}
    </div>
  );
}
