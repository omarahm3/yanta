export interface AssetInfo {
  hash: string;
  ext: string;
  bytes: number;
  mime: string;
  url: string;
}

export function toAssetInfo(
  model: { hash: string; ext: string; bytes: number; mime: string },
  projectAlias: string
): AssetInfo {
  return {
    hash: model.hash,
    ext: model.ext,
    bytes: model.bytes,
    mime: model.mime,
    url: `/assets/${projectAlias}/${model.hash}${model.ext}`,
  };
}
