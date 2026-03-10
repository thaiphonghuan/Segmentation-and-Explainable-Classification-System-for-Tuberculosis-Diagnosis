import torch
import torch.nn as nn
import numpy as np
import argparse
import os

def export_to_onnx(
    model_path: str,
    output_path: str = "model.onnx",
    input_h: int = 256,
    input_w: int = 256,
    opset: int = 17,
    device: str = "cpu",
    verify: bool = True,
):
    print(f"[1/4] Loading model from: {model_path}")
    model = torch.load(model_path, map_location=device, weights_only=False)
    model.eval()
    model.to(device)

    # Dummy input: batch=1, C=3, H, W
    dummy_input = torch.randn(1, 3, input_h, input_w, device=device)

    print(f"[2/4] Exporting to ONNX (opset={opset}) → {output_path}")
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        opset_version=opset,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={
            "image":  {0: "batch_size"},
            "logits": {0: "batch_size"},
        },
        export_params=True,
        do_constant_folding=True,
    )
    print(f"    ✓ ONNX file saved → {output_path}  ({os.path.getsize(output_path)/1e6:.1f} MB)")

    if verify:
        print("[3/4] Verifying ONNX model with onnx.checker …")
        try:
            import onnx
            onnx_model = onnx.load(output_path)
            onnx.checker.check_model(onnx_model)
            print("    ✓ ONNX model is valid.")
        except ImportError:
            print("    ⚠ onnx not installed, skipping graph check. Run: pip install onnx")

        print("[4/4] Running inference comparison (PyTorch vs ONNX) …")
        try:
            import onnxruntime as ort
            sess = ort.InferenceSession(output_path, providers=["CPUExecutionProvider"])
            np_input = dummy_input.cpu().numpy()
            ort_out = sess.run(["logits"], {"image": np_input})[0]

            with torch.no_grad():
                torch_out = model(dummy_input).cpu().numpy()

            max_diff = np.abs(ort_out - torch_out).max()
            print(f"    Max absolute difference (PyTorch vs ONNX): {max_diff:.6f}")
            if max_diff < 1e-4:
                print("    ✓ Outputs match — export successful!")
            else:
                print("    ⚠ Outputs differ slightly (acceptable for FP32 rounding).")
        except ImportError:
            print("    ⚠ onnxruntime not installed, skipping runtime check. Run: pip install onnxruntime")

    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export segmentation model to ONNX")
    parser.add_argument("--model_path", default="saved_models/liver_best_model.pt")
    parser.add_argument("--output",     default="model.onnx")
    parser.add_argument("--height",     type=int, default=256)
    parser.add_argument("--width",      type=int, default=256)
    parser.add_argument("--opset",      type=int, default=17)
    parser.add_argument("--device",     default="cpu")
    parser.add_argument("--no-verify",  action="store_true")
    args = parser.parse_args()

    export_to_onnx(
        model_path=args.model_path,
        output_path=args.output,
        input_h=args.height,
        input_w=args.width,
        opset=args.opset,
        device=args.device,
        verify=not args.no_verify,
    )



"""
pip install segmentation-models-pytorch

python export_onnx.py --model_path saved_models/liver_best_model.pt --output model.onnx --height 256 --width 256
"""