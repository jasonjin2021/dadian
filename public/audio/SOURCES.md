# 当前公开快照说明

当前运行资源为 `lobby/laomushi-gondboy.mp3` 与 `results/` 下的 15 条结算语音。项目所有者已确认随本项目公开上传这些音频，但这不额外担保第三方权利，也不为这些音频统一授予 CC0 或其他开源许可。实际音轨选择见 `lib/lobby-music.ts` 与 `lib/settlement-catalog.ts`，固定内容校验见对应测试。

以下保留历史选材与许可证记录，其中 active、未发布、待审批等措辞仅描述当时状态；下列旧动作音轨不包含在当前运行资源中。Kenney 许可证只适用于其明确列出的历史素材。

---

# Gesture audio sources

## Active user-supplied clips — 2026-10-04

The user explicitly selected files from their local `music` folder. These supersede all Foley drafts listed below.

| Gesture | User source | Active web asset |
| --- | --- | --- |
| 积点 | `music/050_冰冰冰.mp3` | `user-jidian-bing-v1.mp3` |
| 5换6 / 5换7 / 5换8 / 5换9 / 5换10 | `music/003_18码.mp3` | `user-five-exchange-18-v1.mp3` |

- Copied byte-for-byte; SHA-256 matches the user originals. No time stretching, pitch shifting, or editing of the original MP3s. Original durations are approximately 0.824s and 0.888s respectively.
- Both play at gain 0.08 with brief edge fades. The five-exchange MP3 has intersample peaks above 0dBFS when decoded to float, so this low gain is deliberate, not based on clipped 16-bit measurements.
- 积点 starts at 650ms and plays the complete clip once, not once for each fist contact. All five-exchange actions share a single 700ms cue and one clip per reveal, regardless of how many players choose them.
- Sounds are preloaded, independently cached per AudioContext, and cancellable on mute/phase change. Late loading/reconnection seeks to the current position instead of replaying the full clip; no audio extends beyond the reveal.
- Preview starts muted. No fallback to the prior synthetic impact, card, fabric or glass sounds.
- Provenance: user-provided local assets; upstream licensing has not been independently verified. This update is local-only and has not been published.

## Historical drafts — not active

### Former instant gestures: 5换6 / 5换9 / 5换10

- File: `five-exchange-card-v1.wav`
- Source: Kenney, **Casino Audio 1.1**, `Audio/card-slide-1.ogg`.
- Official page: https://kenney.nl/assets/casino-audio
- Download: https://kenney.nl/media/pages/assets/casino-audio/2472606a04-1721639069/kenney_casino-audio.zip
- License: Creative Commons Zero (CC0); bundled license preserved as `kenney-casino-license.txt`.
- Retrieved: 2026-10-03.
- Source page identifies the pack as Foley/card audio, first released in 2012. The page does not state the recording setup. This integration uses the downloaded asset, not generated noise or AI audio.
- Processing: retain 0.06–0.32 seconds, mono PCM16 WAV at 44.1kHz, high-pass 100Hz, low-pass 6500Hz, 4ms fade-in, 50ms fade-out, gain 0.5. Runtime playback gain 0.65; one clip per reveal, no looping.
- Accumulation's existing impact sound is unchanged.

### Retired fabric draft — no longer used

- File: `five-exchange-rotation-v1.wav`, 2.600 seconds, mono PCM16 WAV at 44.1kHz.
- Source: OwlishMedia, **202 More Sound Effects**, `Cloth/Cloth_03.wav` and `Cloth/Cloth_02.wav`.
- Author/source and license page: https://opengameart.org/content/202-more-sound-effects
- Original archive: https://opengameart.org/sites/default/files/MoreSounds.zip
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/ . Source-page licensing observed 2026-10-03; this is a provenance record, not a claim of original authorship.
- The author states these are sounds recorded around their home. Original WAV metadata names a ZOOM Handy Recorder H4n and recording date 2012-02-07. No AI-generated or synthesized sound is used for this cue.
- Processing: take 0.14–1.44 seconds of Cloth_03, then 0.10–1.40 seconds of Cloth_02; high-pass 100Hz / low-pass 6500Hz removes dominant low-frequency handling noise. After filtering, gains of 10 (Cloth_03) and 15 (Cloth_02) bring the quiet cloth detail to similar levels; each has 55ms fade-in and 160ms fade-out. Concatenate once, no looping, pitch change or time stretching. Two 1.3-second sweeps follow the two hand circles. These gains are applied to filtered signals with more than 30dB of peak headroom, not to the original low-frequency-heavy files.
- Runtime gain 0.65 with a short start/end fade. Each reveal plays the rotation group at most once; late loads/joins seek into the corresponding position and stop by 2.6 seconds. Mute or phase change cancels the cue. Instant gestures retain their existing approved file and playback behavior.
- Original cloth files retained under `work/audio-reference/owlish-cloth/`; obtained as complete ZIP members via HTTP Range, since the full archive download was slow.
- Objective checks cover duration, signal continuity, clipping/headroom, decoding and scheduling. Subjective sound approval remains with the user.
- Rejected by the user as unpleasant/loud. Retained only for provenance; the app no longer requests or plays this file.

### Former circling gestures: quiet three-clink revision

- Former file: `five-exchange-ice-v2.wav`, 2.6 seconds, mono PCM16 WAV at 44.1kHz. Three short clinks at 0.1, 1.0 and 1.9 seconds, with silence between them. No longer requested by the app.
- Original: Joseph SARDIN / BigSoundBank, **Cheers champagne flute 1**, sound 1335 — two champagne glasses gently clinking, not glass breaking. Glass is used as an ice/crystal-like Foley, not represented as a recording of real ice.
- Source and licensing: https://bigsoundbank.com/tchin-tchin-flute-de-champagne-1-s1335.html
- Original WAV: https://bigsoundbank.com/UPLOAD/bwf-en/1335.wav
- License: CC0 / public domain; original WAV metadata also explicitly records `CC0 / WTFPL / Public domain`, `encoded_by=BigSoundBank.com`, `originator_reference=1335`, recording date 2019-04-16. Retrieved 2026-10-03. Original retained as `work/audio-reference/glass-clink-1335-original.wav`.
- Processing: first 0.5 seconds, high-pass 300Hz, low-pass 6500Hz, gain 0.22 (attenuation), 4ms fade-in and 180ms fade-out from 0.32s. Three copies are placed at the listed times without overlap; silence pads the track to 2.6s. No synthesized noise, continuous rustle, pitch shift, or infinite loop.
- Runtime rotation gain reduced from 0.65 to 0.16 (about one quarter of the previous amplitude). Instant gestures retain their unchanged short clip and gain. The preview starts muted and is not automatically unmuted on behalf of the user.
- Approval: pending the user's listening feedback. Duration, peak headroom and playback routing are checked; no subjective listening claim is made.
# 推：用户指定的巴哈哈哈哈（2026-10-04）

- 来源：用户工作区 `music/019_巴哈哈哈哈.mp3`；用户明确要求用于“推”。仅用于本地待审批样稿，未发布。
- 保存：`public/audio/user-push-laugh-v1.mp3`，原文件逐字节复制，无合成、变调或循环。原长约3.169秒。
- 播放：出掌700ms起，Web Audio增益0.08；停止/切换/静音会取消，五秒展示结束即停；默认关闭。

