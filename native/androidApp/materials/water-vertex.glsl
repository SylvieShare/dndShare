precision highp float; void materialVertex(inout MaterialVertexInputs m) { m.water=vec4(getPosition().xyz,1.0); m.waterMask=getCustom0(); }
