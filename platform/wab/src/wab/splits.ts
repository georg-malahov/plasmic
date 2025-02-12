import {
  GlobalVariantGroup,
  GlobalVariantSplitContent,
  RandomSplitSlice,
  SegmentSplitSlice,
  Split,
  SplitSlice,
  Variant,
} from "./classes";
import { mkShortId } from "./common";

export enum SplitType {
  Experiment = "experiment",
  Segment = "segment",
  Schedule = "schedule",
}

export enum SplitStatus {
  New = "new",
  Running = "running",
  Stopped = "stopped",
}

function getDefaultSlices(type: SplitType): SplitSlice[] {
  return type === SplitType.Experiment
    ? [
        new RandomSplitSlice({
          uuid: mkShortId(),
          externalId: undefined,
          name: "A",
          contents: [],
          prob: 50,
        }),
        new RandomSplitSlice({
          uuid: mkShortId(),
          externalId: undefined,
          name: "B",
          contents: [],
          prob: 50,
        }),
      ]
    : [
        new SegmentSplitSlice({
          uuid: mkShortId(),
          externalId: undefined,
          name: "A",
          contents: [],
          cond: "{}",
        }),
        new SegmentSplitSlice({
          uuid: mkShortId(),
          externalId: undefined,
          name: "B",
          contents: [],
          cond: "{}",
        }),
      ];
}

export function mkGlobalVariantSplit(opts: {
  group: GlobalVariantGroup;
  variant: Variant;
  type: SplitType;
  status: SplitStatus;
}) {
  const { group, variant, type } = opts;

  const slices = getDefaultSlices(type);

  slices[1].contents.push(
    new GlobalVariantSplitContent({
      group,
      variant,
    })
  );

  return new Split({
    uuid: mkShortId(),
    externalId: undefined,
    name: group.param.variable.name,
    splitType: opts.type,
    status: opts.status,
    slices,
    targetEvents: ["track-conversion"],
    description: undefined,
  });
}
