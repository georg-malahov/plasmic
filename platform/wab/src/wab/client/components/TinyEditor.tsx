// TinyMCE tries to use window.matchMedia when imported, causing it to
// crash if running on node (where window.matchMedia is undefined).
// Although we are in client/, some test specs import from it and fail if
// we remove this `if`.
if (window && "matchMedia" in window) {
  require("tinymce/tinymce");

  require("tinymce/icons/default");
  require("tinymce/models/dom/model");
  require("tinymce/themes/silver");

  require("tinymce/plugins/advlist");
  require("tinymce/plugins/anchor");
  require("tinymce/plugins/autolink");
  require("tinymce/plugins/charmap");
  require("tinymce/plugins/code");
  require("tinymce/plugins/fullscreen");
  require("tinymce/plugins/image");
  require("tinymce/plugins/insertdatetime");
  require("tinymce/plugins/link");
  require("tinymce/plugins/lists");
  require("tinymce/plugins/media");
  require("tinymce/plugins/preview");
  require("tinymce/plugins/searchreplace");
  require("tinymce/plugins/table");
  require("tinymce/plugins/visualblocks");
}

import "tinymce/skins/ui/tinymce-5/skin.min.css";

import { useAppCtx } from "@/wab/client/contexts/AppContexts";
import { Editor, IAllProps } from "@tinymce/tinymce-react";
import * as React from "react";
import { getCmsImageUrl } from "./sidebar/image-asset-controls";

type TinyEditorProps = Omit<IAllProps, "onChange"> & {
  onChange: (value: string) => void;
};

export function TinyEditor({ value, onChange, ...props }: TinyEditorProps) {
  const appCtx = useAppCtx();
  return (
    <div>
      <Editor
        init={{
          skin: false,
          content_css: false,
          height: 500,
          width: 600,
          menubar: false,
          statusbar: false,
          content_style: `body {
              font-family: Helvetica, Arial, sans-serif;
              font-size: 13px;
              line-height: 1.42;
            }

            img {
              height: auto;
              max-width: 100%;
            }`,
          plugins: [
            "advlist",
            "anchor",
            "autolink",
            "charmap",
            "code",
            "fullscreen",
            "image",
            "insertdatetime",
            "link",
            "lists",
            "media",
            "preview",
            "searchreplace",
            "table",
            "visualblocks",
          ],
          toolbar: [
            "blocks | bold italic underline strikethrough | forecolor backcolor | numlist bullist outdent indent",
            "link image media | blockquote code | superscript subscript | alignleft aligncenter alignright alignjustify | removeformat",
          ],
          images_upload_handler: async (blobInfo) => {
            const uploaded = await appCtx.api.uploadImageFile({
              imageFile: blobInfo.blob(),
            });
            return getCmsImageUrl(uploaded);
          },
        }}
        {...props}
        value={value}
        onEditorChange={(newValue) => onChange(newValue)}
      />
    </div>
  );
}
