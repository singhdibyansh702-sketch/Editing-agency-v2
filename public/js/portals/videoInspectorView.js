/**
 * Video Inspector View
 * Connects to the Python / Node inspection engine for technical stream parsing and keyframe generation.
 */

const VideoInspectorView = {
  render(container) {
    container.innerHTML = `
      <div style="margin-bottom:24px">
        <h1 class="page-title">Technical Video Inspector</h1>
        <p class="card-subtitle">
          Automated metadata inspection via Python / ffprobe. Parses resolution, frame rates, codecs, and generates preview keyframes.
        </p>
      </div>

      <div class="card">
        <form id="inspect-video-form" onsubmit="event.preventDefault(); VideoInspectorView.inspect();">
          <div class="form-group">
            <label class="form-label">Raw Video Footage Link or File URL *</label>
            <div style="display:flex;gap:12px">
              <input type="url" id="inspect-url-input" class="form-control" placeholder="https://drive.google.com/drive/folders/... or direct .mp4/.mov" value="https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ" required>
              <button type="submit" id="inspect-submit-btn" class="btn btn-primary" style="flex-shrink:0">
                <i data-lucide="scan" style="width:16px;height:16px"></i> Inspect Asset
              </button>
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px">
              Supports Google Drive folders, Dropbox links, direct video URLs, and master container packages.
            </div>
          </div>
        </form>
      </div>

      <!-- Loading State -->
      <div id="inspector-loading" style="display:none;text-align:center;padding:40px">
        <div style="display:inline-block;width:32px;height:32px;border:3px solid rgba(37,99,235,0.2);border-radius:50%;border-top-color:var(--accent-primary);animation:spin 0.8s linear infinite"></div>
        <p style="margin-top:12px;font-size:0.9rem;color:var(--text-secondary)">Inspecting video container, audio tracks, and rendering keyframes...</p>
      </div>

      <!-- Results Display -->
      <div id="inspector-results" style="display:none"></div>
    `;

    if (window.lucide) window.lucide.createIcons();
  },

  async inspect() {
    const input = document.getElementById('inspect-url-input');
    const url = input?.value?.trim();
    if (!url) return;

    const loadingEl = document.getElementById('inspector-loading');
    const resultsEl = document.getElementById('inspector-results');

    if (loadingEl) loadingEl.style.display = 'block';
    if (resultsEl) resultsEl.style.display = 'none';

    try {
      const res = await API.post('/video/inspect', { url });
      const meta = res.data;

      if (!meta) {
        Toast.error('Could not parse metadata for this asset.');
        return;
      }

      if (resultsEl) {
        resultsEl.innerHTML = `
          <div class="card" style="border-left:4px solid var(--accent-primary)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:20px">
              <div>
                <span class="badge badge-approved" style="margin-bottom:6px">
                  ${meta.source === 'ffprobe' ? 'FFprobe Verified' : 'Stream Profile Verified'}
                </span>
                <h2 style="font-size:1.25rem;font-weight:700">${meta.title}</h2>
                <div style="font-size:0.85rem;color:var(--text-muted)">${meta.notes || ''}</div>
              </div>

              ${meta.is_4k ? `
                <span class="badge badge-review" style="font-size:0.85rem;padding:6px 12px">
                  4K Ultra HD Broadcast Asset
                </span>
              ` : `
                <span class="badge badge-progress" style="font-size:0.85rem;padding:6px 12px">
                  1080p Full HD Asset
                </span>
              `}
            </div>

            <!-- Technical Attributes Grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;margin-bottom:24px">
              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Duration</div>
                <div style="font-size:1.35rem;font-weight:700">${meta.duration_formatted}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${meta.duration_seconds} seconds total</div>
              </div>

              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Resolution & Aspect</div>
                <div style="font-size:1.35rem;font-weight:700">${meta.resolution}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">Aspect Ratio: ${meta.aspect_ratio}</div>
              </div>

              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Frame Rate (FPS)</div>
                <div style="font-size:1.35rem;font-weight:700">${meta.frame_rate} fps</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">Standard Broadcast Cadence</div>
              </div>

              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Video Codec</div>
                <div style="font-size:1.15rem;font-weight:700">${meta.video_codec}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">Bitrate: ~${meta.bitrate_kbps ? (meta.bitrate_kbps / 1000).toFixed(1) + ' Mbps' : 'Variable'}</div>
              </div>

              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Audio Specs</div>
                <div style="font-size:1.15rem;font-weight:700">${meta.audio_codec || 'AAC'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${meta.audio_sample_rate || 48000} Hz | ${meta.audio_channels || 2} Channels</div>
              </div>

              <div style="padding:14px;background:var(--bg-tertiary);border-radius:var(--radius-lg)">
                <div class="stat-title">Estimated Size</div>
                <div style="font-size:1.35rem;font-weight:700">${meta.file_size_mb ? meta.file_size_mb + ' MB' : 'Cloud Master'}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">Uncompressed footprint</div>
              </div>
            </div>

            <!-- Keyframe Previews -->
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="font-size:1rem;font-weight:700">Automated Keyframe Thumbnail Previews</h3>
                <span style="font-size:0.75rem;color:var(--text-muted)">Sampled at 10%, 50%, and 80% marks</span>
              </div>

              <div class="keyframe-grid">
                ${(meta.thumbnails || []).map(thumb => `
                  <div class="keyframe-card">
                    <img src="${thumb.data_url}" alt="Keyframe Preview ${thumb.mark}" class="keyframe-img">
                    <div class="keyframe-caption">
                      <span>Timeline: ${thumb.time}</span>
                      <strong style="color:var(--accent-primary)">${thumb.mark} MARK</strong>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
        resultsEl.style.display = 'block';
      }

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error(err);
      Toast.error('Video inspection failed. Please check the provided link.');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }
};

window.VideoInspectorView = VideoInspectorView;

