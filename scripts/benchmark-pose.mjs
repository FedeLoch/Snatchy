import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { analyzePoseSamples, anglesAt, SIDES } = await server.ssrLoadModule(
    '/src/domain/vision.ts',
  );
  const { reliablePoseFrames } = await server.ssrLoadModule(
    '/src/domain/pose-quality.ts',
  );
  const { liftFrames } = await server.ssrLoadModule(
    '/tests/fixtures/lift-pose.ts',
  );
  const clean = liftFrames(),
    spike = structuredClone(clean);
  for (const id of [13, 14])
    spike[1].landmarks[id] = {
      ...spike[1].landmarks[id],
      x: spike[1].landmarks[id].x - 0.28,
    };
  const cases = [
    {
      id: 'synthetic-clean',
      frames: clean,
      width: 100,
      height: 100,
      duration: 2,
      truth: clean,
    },
    {
      id: 'synthetic-isolated-spike',
      frames: spike,
      width: 100,
      height: 100,
      duration: 2,
      truth: clean,
    },
  ];
  const recorded = JSON.parse(
    await readFile('tests/fixtures/recorded-phase-traces.json', 'utf8'),
  );
  for (const t of recorded)
    cases.push({
      ...t,
      id: t.name,
      frames: t.rows.map((row) => {
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0,
          y: 0,
          visibility: 0,
        }));
        SIDES[t.side].forEach((id, i) => {
          const p = row[i + 1];
          if (Array.isArray(p))
            landmarks[id] = { x: p[0], y: p[1], visibility: p[2] };
        });
        return { time: row[0], people: row.length > 1 ? 1 : 0, landmarks };
      }),
    });
  const expert = JSON.parse(
    await readFile('tests/fixtures/expert-phase-traces.json', 'utf8'),
  );
  for (const t of expert)
    cases.push({
      ...t,
      id: 'expert-' + t.name,
      frames: t.rows.map((row) => {
        const landmarks = Array.from({ length: 33 }, () => ({
          x: 0,
          y: 0,
          visibility: 0,
        }));
        [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach((id, i) => {
          const p = row[i + 2];
          landmarks[id] = { x: p[0], y: p[1], visibility: p[2] };
        });
        return { time: row[0], people: row[1], landmarks };
      }),
    });
  // Optional manually annotated references keyed by case id. Never derive these
  // from the detector's own predictions; unannotated error fields stay null.
  const referencesPath = process.env.POSE_REFERENCES;
  const refs = referencesPath
    ? JSON.parse(await readFile(referencesPath, 'utf8'))
    : {};
  const results = cases.map((c) => {
    const a = analyzePoseSamples(
      c.frames,
      c.width,
      c.height,
      c.duration,
      15,
      'auto',
    );
    const filtered = reliablePoseFrames(c.frames, c.width, c.height, 15);
    const errors = (frames) => {
      const list = [],
        references = c.truth
          ? c.truth.flatMap((f) =>
              Object.entries(anglesAt(f, 'left', c.width, c.height)).map(
                ([joint, value]) => ({
                  time: f.time,
                  side: 'left',
                  joint,
                  value,
                }),
              ),
            )
          : (refs[c.id]?.angles ?? []);
      for (const ref of references) {
        const f = frames.find((f) => Math.abs(f.time - ref.time) < 0.001);
        if (!f) continue;
        const v = anglesAt(f, ref.side, c.width, c.height)[ref.joint];
        if (v !== null && ref.value !== null)
          list.push(Math.abs(v - ref.value));
      }
      return {
        meanDegrees: list.length
          ? list.reduce((s, v) => s + v, 0) / list.length
          : null,
        compared: list.length,
        referenceCount: references.length,
      };
    };
    const phaseErrors = Object.entries(refs[c.id]?.phases ?? {}).flatMap(
      ([name, time]) => {
        const p = a.lift.phases.find((p) => p.name === name);
        return p?.start !== null && p?.start !== undefined
          ? [Math.abs(p.start - time)]
          : [];
      },
    );
    return {
      id: c.id,
      referenceKind: c.truth
        ? 'synthetic'
        : refs[c.id]
          ? 'manual'
          : 'unannotated',
      rawAngleError: errors(c.frames),
      filteredAngleError: errors(filtered),
      phaseReferenceCount: Object.keys(refs[c.id]?.phases ?? {}).length,
      phaseCompared: phaseErrors.length,
      phaseMeanAbsoluteErrorSeconds: phaseErrors.length
        ? phaseErrors.reduce((s, v) => s + v, 0) / phaseErrors.length
        : null,
      rejectedLandmarks: filtered.reduce(
        (s, f, i) =>
          s +
          f.landmarks.filter(
            (p, j) =>
              p.visibility === 0 &&
              c.frames[i].landmarks[j]?.visibility >= 0.65,
          ).length,
        0,
      ),
      side: a.side,
      coverage: a.coverage,
      phaseTimes: Object.fromEntries(
        a.lift.phases.map((p) => [p.name, p.start]),
      ),
      checks: a.lift.checks.map((c) => ({
        name: c.name,
        value: c.value,
        passed: c.passed,
      })),
    };
  });
  const output =
    JSON.stringify(
      {
        version: 1,
        note: 'Synthetic truth and unannotated trace diagnostics are separate. Null error means no manual reference, not zero error.',
        results,
      },
      null,
      2,
    ) + '\n';
  if (process.argv[2]) await writeFile(process.argv[2], output);
  else process.stdout.write(output);
} finally {
  await server.close();
}
