import { Config } from '../src/model/config'

describe('Config', () => {
  describe('read', () => {
    it('should read config file', () => {
      const validConfig = `{
        "packages": {
          "foo": {
            "type": "github",
            "repo": "foo/bar"
          }
        }
      }`

      const invalidConfigs = [
        `["invalid"]`,
        `{
          "invalid": "invalid"
        }`,
        `{
          "packages": "invalid"
        }`,
        `{
          "packages": 123
        }`,
        `{
          "packages": {
            "foo": "invalid"
          }
        }`
      ]

      for (const invalidConfig of invalidConfigs) {
        expect(() => {
          Config.read(invalidConfig)
        }).toThrow()
      }

      expect(() => {
        Config.read(validConfig)
      }).not.toThrow()
    })
  })
})
