const TARGET_MAX_BYTES = 1_800_000;
const MAX_EDGE_PX = 2200;
const JPEG_QUALITY = 0.82;
const DEFAULT_ATTEMPTS = 3;
const BASE_DELAY_MS = 450;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Downscale large camera photos before presigned PUT to reduce failures and timeouts.
 */
export async function prepareReceiptUpload(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
        return file;
    }
    if (file.size <= TARGET_MAX_BYTES) {
        return file;
    }
    return compressImageToJpeg(file, MAX_EDGE_PX);
}

function compressImageToJpeg(file: File, maxEdge: number): Promise<File> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            const longest = Math.max(width, height);
            const scale = longest > maxEdge ? maxEdge / longest : 1;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }
                    const base = file.name.replace(/\.[^.]+$/, '') || 'receipt';
                    resolve(
                        new File([blob], `${base}-upload.jpg`, {
                            type: 'image/jpeg',
                        }),
                    );
                },
                'image/jpeg',
                JPEG_QUALITY,
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
}

/**
 * PUT to a presigned URL with simple backoff for transient errors.
 */
export async function putToPresignedUrl(
    uploadUrl: string,
    body: Blob,
    contentType: string,
    options?: { attempts?: number },
): Promise<void> {
    const attempts = options?.attempts ?? DEFAULT_ATTEMPTS;
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            const res = await fetch(uploadUrl, {
                method: 'PUT',
                body,
                headers: { 'Content-Type': contentType },
                mode: 'cors',
            });
            if (res.ok) {
                return;
            }
            if (res.status >= 500 || res.status === 429) {
                await sleep(BASE_DELAY_MS * 2 ** i);
                continue;
            }
            throw new Error(
                `Could not upload file (${res.status}). Try a smaller photo.`,
            );
        } catch (e) {
            lastErr = e;
            if (i === attempts - 1) {
                break;
            }
            await sleep(BASE_DELAY_MS * 2 ** i);
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error('Upload failed — check your connection and try again.');
}
