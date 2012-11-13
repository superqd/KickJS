define(["kick/core/Constants", "kick/core/Util", "kick/math/Mat3", "kick/math/Mat4", "kick/math/Vec3", "kick/math/Quat4"],
    function (Constants, Util, Mat3, Mat4, Vec3, Quat4) {
        "use strict";

        var ASSERT = Constants._ASSERT;

        /**
         * Datastructure used pass light information
         * @class SceneLights
         * @namespace KICK.scene
         * @constructor
         * @param {Number} maxNumerOfLights (value from config)
         */
        return function (maxNumerOfLights) {
            var ambientLight = null,
                directionalLight = null,
                directionalLightData = Mat3.create(), // column matrix with the columns lightDirection,colorIntensity,halfVector
                directionalLightDirection = directionalLightData.subarray(0, 3),
                directionalLightColorIntensity = directionalLightData.subarray(3, 6),
                directionalHalfVector = directionalLightData.subarray(6, 9),
                directionalLightDirectionWorld = Vec3.create([1, 0, 0]),
                directionalLightTransform = null,
                pointLightData = new Float32Array(9 * maxNumerOfLights), // mat3*maxNumerOfLights
                pointLightDataVec3 = Vec3.wrapArray(pointLightData),
                pointLights = [],
                lightDirection = [0, 0, 1],
                /**
                 * Set the point light to have not contribution this means setting the position 1,1,1, the color to 0,0,0
                 * and attenuation to 1,0,0.<br>
                 * This is needed since the ecLight position would otherwise be in 0,0,0 which is invalid
                 * @method resetPointLight
                 * @param {Number} index of point light
                 * @private
                 */
                resetPointLight = function (index) {
                    var i;
                    for (i = 0; i < 3; i++) {
                        Vec3.set([0, 0, 0], pointLightDataVec3[index * 3 + i]);
                    }
                };
            Object.defineProperties(this, {
                /**
                 * The ambient light in the scene.
                 * @property ambientLight
                 * @type KICK.scene.Light
                 */
                ambientLight: {
                    get: function () {
                        return ambientLight;
                    },
                    set: function (value) {
                        if (ASSERT) {
                            if (value && ambientLight) {
                                throw new Error("Cannot have multiple ambient lights in the scene");
                            }
                        }
                        ambientLight = value;
                    }
                },
                /**
                 * The directional light in the scene.
                 * @property directionalLight
                 * @type KICK.scene.Light
                 */
                directionalLight: {
                    get: function () {
                        return directionalLight;
                    },
                    set: function (value) {
                        if (ASSERT) {
                            if (value && directionalLight) {
                                throw new Error("Cannot have multiple directional lights in the scene");
                            }
                        }
                        directionalLight = value;
                        if (value !== null) {
                            directionalLightTransform = directionalLight.gameObject.transform;
                        } else {
                            directionalLightTransform = null;
                            Mat3.set([0, 0, 0, 0, 0, 0, 0, 0, 0], directionalLightData);
                        }
                    }
                },
                /**
                 * Matrix of directional light data. Column 1 contains the light-direction in eye space,
                 * column 2 color intensity and column 3 half vector
                 * @property directionalLightData
                 * @type KICK.math.mat3
                 */
                directionalLightData: {
                    get: function () {
                        return directionalLightData;
                    }
                },
                /**
                 * Return the directional light in world space
                 * @property directionalLightWorld
                 * @type KICK.math.vec3
                 */
                directionalLightWorld: {
                    get: function () {
                        return directionalLightDirectionWorld;
                    }
                },
                /**
                 * Matrices of point light data. Each matrix (mat3) contains:<br>
                 * Column 1 vector: point light position in eye coordinates<br>
                 * Column 2 vector: color intensity<br>
                 * Column 3 vector: attenuation vector
                 */
                pointLightData: {
                    get: function () {
                        return pointLightData;
                    }
                }
            });

            /**
             * @method addPointLight
             * @param {KICK.scene.Light} pointLight
             */
            this.addPointLight = function (pointLight) {
                if (!Util.contains(pointLights, pointLight)) {
                    if (pointLights.length === maxNumerOfLights) {
                        if (ASSERT) {
                            Util.fail("Only " + maxNumerOfLights + " point lights allowed in scene");
                        }
                    } else {
                        pointLights.push(pointLight);
                    }
                }
            };

            /**
             * @method removePointLight
             * @param {KICK.scene.Light} pointLight
             */
            this.removePointLight = function (pointLight) {
                var index = pointLights.indexOf(pointLight);
                if (index >= 0) {
                    // remove element at position index
                    pointLights.splice(index, 1);
                } else {
                    if (ASSERT) {
                        Util.fail("Error removing point light");
                    }
                }
                resetPointLight(pointLights.length);
            };

            /**
             * Recompute the light based on the view-matrix. This method is called from the camera when the scene is
             * rendered, to transform the light into eye coordinates and compute the half vector for directional light
             * @method recomputeLight
             * @param {KICK.math.mat4} viewMatrix
             */
            this.recomputeLight = function (viewMatrix) {
                if (directionalLight !== null) {
                    // compute light direction
                    Quat4.multiplyVec3(directionalLightTransform.rotation, lightDirection, directionalLightDirectionWorld);

                    // transform to eye space
                    Mat4.multiplyVec3Vector(viewMatrix, directionalLightDirectionWorld, directionalLightDirection);
                    Vec3.normalize(directionalLightDirection);

                    // compute half vector
                    Vec3.add(lightDirection, directionalLightDirection, directionalHalfVector);
                    Vec3.normalize(directionalHalfVector);

                    Vec3.set(directionalLight.colorIntensity, directionalLightColorIntensity);
                }
                if (maxNumerOfLights) { // only run if max number of lights are 1 or above (otherwise JIT compiler will skip it)
                    var index = 0,
                        i,
                        pointLight,
                        pointLightPosition;
                    for (i = pointLights.length - 1; i >= 0; i--) {
                        pointLight = pointLights[i];
                        pointLightPosition = pointLight.transform.position;

                        Mat4.multiplyVec3(viewMatrix, pointLightPosition, pointLightDataVec3[index]);
                        Vec3.set(pointLight.colorIntensity, pointLightDataVec3[index + 1]);
                        Vec3.set(pointLight.attenuation, pointLightDataVec3[index + 2]);
                        index += 3;
                    }
                }
            };

            (function init() {
                var i;
                for (i = 0; i < maxNumerOfLights; i++) {
                    resetPointLight(i);
                }
            }());
        };
    });