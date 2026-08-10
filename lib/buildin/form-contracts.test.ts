import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { BUILDIN_DATABASE_DEFS } from "./database-defs"
import {
  FORM_QUEUE_COLUMNS,
  FORM_QUEUE_CONTRACTS,
  catalogApplicationTitle,
  catalogArtistSummary,
  pickPromoPayload,
  type FileFormType,
} from "./form-contracts"

const DB_KEY_BY_FORM: Record<FileFormType, keyof typeof BUILDIN_DATABASE_DEFS> = {
  catalog_upload: "form_back_catalog",
  release_upload: "form_release_upload",
  distribution: "form_distribution",
}

describe("form contracts", () => {
  it("Buildin schema has only the four application columns", () => {
    for (const formType of Object.keys(FORM_QUEUE_CONTRACTS) as FileFormType[]) {
      const contract = FORM_QUEUE_CONTRACTS[formType]
      const props = BUILDIN_DATABASE_DEFS[DB_KEY_BY_FORM[formType]].properties
      const allowed = new Set<string>([...FORM_QUEUE_COLUMNS])
      assert.deepEqual(
        [...Object.keys(props)],
        [...FORM_QUEUE_COLUMNS],
        `${formType}: columns must be exactly Артист → Название релиза → Дата заявки → Обработана`
      )
      for (const name of Object.keys(props)) {
        assert.ok(
          allowed.has(name),
          `${formType}: unexpected Buildin column «${name}»`
        )
      }
      for (const col of contract.userColumns) {
        assert.ok(col in props, `${formType}: missing user column «${col}»`)
      }
      for (const bad of contract.forbiddenColumns) {
        assert.equal(
          bad in props,
          false,
          `${formType}: forbidden column «${bad}» present in schema`
        )
      }
    }
  })

  it("catalog title and artist summary are honest for multi-release", () => {
    assert.equal(
      catalogApplicationTitle([{ releaseTitle: "One" }]),
      "One"
    )
    assert.equal(
      catalogApplicationTitle([
        { releaseTitle: "A" },
        { releaseTitle: "B" },
      ]),
      "Бэк-каталог — 2 релизов"
    )
    assert.equal(
      catalogArtistSummary([
        { artists: "Alpha, Beta" },
        { artists: "Beta, Gamma" },
      ]),
      "Alpha, Beta, Gamma"
    )
  })

  it("pickPromoPayload allowlists promo keys only", () => {
    const picked = pickPromoPayload({
      submitToPromo: "1",
      artistInfo: "bio",
      releaseType: "1",
      email: "x@y.z",
      contactEmail: "nope",
      otherComments: "hi",
      upc: "123",
    })
    assert.deepEqual(picked, {
      submitToPromo: "1",
      artistInfo: "bio",
      otherComments: "hi",
    })
  })
})
