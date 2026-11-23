"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import {
  createPairing,
  deleteDevice,
  listAccess,
  listDevices,
  listSoftware,
  pairingStatus,
  setAccess,
  updateDevice,
  type Channel,
  type Device,
  type DeviceKind,
} from "@/lib/api";
import { siteUrl } from "@/lib/beta";
import { useQuery } from "@/lib/useQuery";
import { DeviceGlyph, Icon } from "./Icon";
import {
  Badge,
  Button,
  Empty,
  ErrorNote,
  Group,
  Loading,
  Row,
  Section,
  Select,
  Sheet,
  Switch,
  TextField,
  ago,
  styles as s,
  useAction,
} from "./ui";

export const KIND_LABEL: Record<DeviceKind, string> = {
  phone: "Phone",
  tablet: "Tablet",
  laptop: "Laptop",
  pi: "Raspberry Pi",
  other: "Other device",
};

/* ---------- Add a device: QR code + live wait for the device to claim it ---------- */

function AddDeviceSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [pairing, setPairing] = useState<{ code: string; expires_at: string; qr: string; url: string } | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());

  // Fresh code each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    let live = true;
    createPairing()
      .then(async (p) => {
        const url = `${siteUrl()}/pair?code=${p.code}`;
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 440, errorCorrectionLevel: "M" });
        if (live) {
          setPairing({ ...p, qr, url });
          setClaimed(null);
          setError(undefined);
        }
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      live = false;
      setPairing(null);
    };
  }, [open]);

  // Watch for the device to finish pairing, and count down the expiry.
  useEffect(() => {
    if (!open || !pairing || claimed) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      try {
        const st = await pairingStatus(pairing.code);
        if (st.device_id) {
          setClaimed(st.device?.name ?? "New device");
          onAdded();
        }
      } catch {
        /* keep waiting */
      }
    }, 2500);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [open, pairing, claimed, onAdded]);

  const left = pairing ? Math.max(0, Math.round((new Date(pairing.expires_at).getTime() - now) / 1000)) : 0;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  return (
    <Sheet open={open} onClose={onClose} title={claimed ? "Device added." : "Add a device."}>
      {claimed ? (
        <div className={s.pairing}>
          <DeviceGlyph kind="tablet" size={72} />
          <p className={s.lead} style={{ marginTop: 0 }}>
            <strong>{claimed}</strong> is now on your team. Give it access to software from its device page.
          </p>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : error ? (
        <ErrorNote message={error} />
      ) : !pairing ? (
        <Loading rows={2} />
      ) : (
        <div className={s.pairing}>
          <p className={s.lead} style={{ marginTop: 0 }}>
            <strong>Scan this with the phone or tablet you want to add.</strong> Or open{" "}
            <span style={{ whiteSpace: "nowrap" }}>{siteUrl().replace(/^https?:\/\//, "")}/pair</span> on it and type the code.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.qr} src={pairing.qr} alt={`QR code for pairing code ${pairing.code}`} />
          <div className={s.code} aria-label={`Pairing code ${pairing.code.split("").join(" ")}`}>
            {pairing.code}
          </div>
          <p className={s.note} role="status">
            {left > 0 ? `Waiting for the device… code expires in ${mm}:${ss}` : "This code expired. Close and try again."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

/* ---------- One device: rename, software access, revoke ---------- */

function DeviceSheet({
  device,
  canManage,
  onClose,
  onChanged,
}: {
  device: Device | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const software = useQuery(() => listSoftware(), []);
  const access = useQuery(() => (device ? listAccess(device.id) : Promise.resolve([])), [device?.id]);
  const [name, setName] = useState(device?.name ?? "");
  const act = useAction();

  if (!device) return null;

  const granted = new Map((access.data ?? []).map((a) => [a.software_id, a.channel]));
  const revoked = device.status === "revoked";

  const change = async (softwareId: string, channel: Channel | null, label: string) => {
    await act(() => setAccess(device.id, softwareId, channel), label);
    access.reload();
  };

  return (
    <Sheet open onClose={onClose} title={device.name}>
      <div style={{ display: "grid", gap: 22 }}>
        <Group>
          <Row title="Type" end={<span className={s.rowSub}>{KIND_LABEL[device.kind]}</span>} />
          {device.platform && <Row title="System" end={<span className={s.rowSub}>{device.platform}</span>} />}
          {device.team && <Row title="Team" end={<span className={s.rowSub}>{device.team.number}</span>} />}
          <Row title="Added" end={<span className={s.rowSub}>{ago(device.created_at)}</span>} />
          <Row title="Last checked in" end={<span className={s.rowSub}>{ago(device.last_seen_at)}</span>} />
          <Row
            title="Status"
            end={revoked ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Active</Badge>}
          />
        </Group>

        {canManage && (
          <form
            className={s.form}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await act(() => updateDevice(device.id, { name: name.trim() }), "Renamed")) onChanged();
            }}
          >
            <TextField label="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            <div className={s.actions}>
              <Button type="submit" disabled={!name.trim() || name.trim() === device.name}>
                Rename
              </Button>
            </div>
          </form>
        )}

        <div>
          <h3 className={s.sectionTitle} style={{ fontSize: 17 }}>
            Software access
          </h3>
          {!software.data ? (
            <Loading rows={1} />
          ) : software.data.length === 0 ? (
            <Empty title="No software published yet." />
          ) : (
            <Group>
              {software.data.map((sw) => {
                const ch = granted.get(sw.id) ?? null;
                return (
                  <Row
                    key={sw.id}
                    title={sw.name}
                    sub={ch ? (ch === "beta" ? "Gets beta builds" : "Gets stable builds") : "No access"}
                    end={
                      <>
                        {ch && canManage && (
                          <Select
                            aria-label={`${sw.name} channel`}
                            value={ch}
                            disabled={revoked}
                            onChange={(e) => change(sw.id, e.target.value as Channel, "Channel updated")}
                          >
                            <option value="stable">Stable</option>
                            <option value="beta">Beta</option>
                          </Select>
                        )}
                        <Switch
                          label={`Allow ${sw.name} on ${device.name}`}
                          checked={Boolean(ch)}
                          disabled={!canManage || revoked}
                          onChange={(on) =>
                            change(sw.id, on ? "stable" : null, on ? `${sw.name} allowed` : `${sw.name} removed`)
                          }
                        />
                      </>
                    }
                  />
                );
              })}
            </Group>
          )}
          {!canManage && <p className={s.note}>Ask a team owner or admin to change what this device can run.</p>}
        </div>

        {canManage && (
          <div className={s.actions} style={{ justifyContent: "space-between" }}>
            <Button
              variant="danger"
              onClick={async () => {
                if (!window.confirm(`Delete ${device.name}? It will need to be paired again.`)) return;
                if (await act(() => deleteDevice(device.id), "Device deleted")) {
                  onChanged();
                  onClose();
                }
              }}
            >
              Delete device
            </Button>
            <Button
              onClick={async () => {
                const next = revoked ? "active" : "revoked";
                if (await act(() => updateDevice(device.id, { status: next }), revoked ? "Access restored" : "Access revoked"))
                  onChanged();
              }}
            >
              {revoked ? "Restore access" : "Revoke access"}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* ---------- The panel ---------- */

export function DevicesPanel({
  teamId,
  canManage,
  canAdd,
  showTeam,
}: {
  teamId?: string;
  canManage: boolean;
  canAdd: boolean;
  showTeam?: boolean;
}) {
  const { data, error, reload } = useQuery(() => listDevices(teamId), [teamId]);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = data?.find((d) => d.id === openId) ?? null;

  return (
    <>
      <Section
        title={showTeam ? "All devices" : "Devices"}
        aside={
          canAdd ? (
            <Button variant="primary" onClick={() => setAdding(true)}>
              <Icon name="qr" size={16} />
              Add device
            </Button>
          ) : data ? (
            `${data.length} registered`
          ) : undefined
        }
      >
        {!data ? (
          error ? (
            <ErrorNote message={error} />
          ) : (
            <Loading />
          )
        ) : data.length === 0 ? (
          <Empty title="No devices yet.">
            {canAdd
              ? "Add the phones and tablets your scouts use. Each one scans a code once."
              : "Devices appear here once a team pairs them."}
          </Empty>
        ) : (
          <div className={s.tiles}>
            {data.map((d) => (
              <button
                key={d.id}
                type="button"
                className={s.tile}
                data-revoked={d.status === "revoked" ? "" : undefined}
                onClick={() => setOpenId(d.id)}
              >
                <DeviceGlyph kind={d.kind} />
                <span className={s.tileName}>{d.name}</span>
                <span className={s.tileSub}>
                  {showTeam && d.team ? `Team ${d.team.number} · ` : ""}
                  {KIND_LABEL[d.kind]}
                </span>
                {d.status === "revoked" ? (
                  <Badge tone="red">Revoked</Badge>
                ) : (
                  <span className={s.tileSub}>
                    {d.last_seen_at ? `Seen ${ago(d.last_seen_at)}` : "Not checked in yet"}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Section>

      {canAdd && <AddDeviceSheet open={adding} onClose={() => setAdding(false)} onAdded={reload} />}
      <DeviceSheet key={openId ?? "none"} device={open} canManage={canManage} onClose={() => setOpenId(null)} onChanged={reload} />
    </>
  );
}
