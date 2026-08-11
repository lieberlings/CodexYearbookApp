import { TemplatePack } from "../templateTypes";

export const figmaTemplatePack: TemplatePack = {
  id: "figma",
  label: "Figma Layouts",
  templates: [
    {
      id: "figma-4-3-strip-top-large-90-left",
      label: "4 - 3 strip top large 90 left",
      photoCount: 4,
      baseScore: 24,
      slots: [
        {
          id: "slot-1",
          role: "hero",
          fitMode: "cover",
          priority: 1,
          preferredOrientation: "portrait",
          frame: { x: 0.0487, y: 0.0487, width: 0.5269, height: 0.9025 }
        },
        {
          id: "slot-2",
          role: "photo",
          fitMode: "cover",
          priority: 2,
          preferredOrientation: "landscape",
          frame: { x: 0.6243, y: 0.0487, width: 0.3489, height: 0.2846 }
        },
        {
          id: "slot-3",
          role: "photo",
          fitMode: "cover",
          priority: 3,
          preferredOrientation: "landscape",
          frame: { x: 0.6243, y: 0.3577, width: 0.3509, height: 0.2846 }
        },
        {
          id: "slot-4",
          role: "photo",
          fitMode: "cover",
          priority: 4,
          preferredOrientation: "landscape",
          frame: { x: 0.6243, y: 0.6667, width: 0.3514, height: 0.2846 }
        }
      ]
    },
    {
      id: "figma-5-3-strip-top-2-large-bottom",
      label: "5 - 3 strip top 2 large bottom",
      photoCount: 5,
      baseScore: 24,
      slots: [
        {
          id: "slot-1",
          role: "photo",
          fitMode: "cover",
          priority: 1,
          preferredOrientation: "portrait",
          frame: { x: 0.0487, y: 0.0482, width: 0.2846, height: 0.3514 }
        },
        {
          id: "slot-2",
          role: "photo",
          fitMode: "cover",
          priority: 2,
          preferredOrientation: "portrait",
          frame: { x: 0.3577, y: 0.0487, width: 0.2846, height: 0.3509 }
        },
        {
          id: "slot-3",
          role: "photo",
          fitMode: "cover",
          priority: 3,
          preferredOrientation: "portrait",
          frame: { x: 0.6667, y: 0.0507, width: 0.2846, height: 0.3489 }
        },
        {
          id: "slot-4",
          role: "photo",
          fitMode: "cover",
          priority: 4,
          preferredOrientation: "portrait",
          frame: { x: 0.0487, y: 0.4244, width: 0.4391, height: 0.5269 }
        },
        {
          id: "slot-5",
          role: "photo",
          fitMode: "cover",
          priority: 5,
          preferredOrientation: "portrait",
          frame: { x: 0.5122, y: 0.4244, width: 0.4391, height: 0.5269 }
        }
      ]
    }
  ]
};
