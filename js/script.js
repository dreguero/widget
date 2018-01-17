/**
 * Licensed Materials - Property of NASA Jet Propulsion Laboratory
 * (c) 2017. All Rights Reserved. Created by Techrev
 * Version: 0.1.7
 */
// FIXME: If no links are present on any artifact links, stop the spinning icon.
// FIXME: Improve error messaging ?
/**
 * Declare globals/constants
 */
// so we don't lose the reference of our methods when inside callback methods.
var self = this;
/**
 * array of objects that will retrieve all artifacts found, the object looks like so 
 * {
 *  id: the id of the artifact,
 *  aTags: any <a> tag that the artifact has.,
 *  uri: the uri for the artifact. 
 * }
 */
var allArtifacts = {};
var artifactsWithHeaders = [];
// the original table html before it gets updated, this variable will have data after the "accept" button is pressed.
var originalTableHtml = null;
// some html dom constants
var initialMessage = "Choose an Artifact with the table to update.";
var widgetDisplayButtons =
    "<div class='actionContainer'><button id='accept' class='actionsButton'><span>Run</span></button><button id='cancel' class='actionsButton'><span>Revert</span></button></div>";
// the artifact reference object, you will get this when you select an artifact.
var ref = {};

// subscribe our methods to the appropiate events.
RM.Event.subscribe(RM.Event.ARTIFACT_SELECTED, onSelection);
RM.Event.subscribe(RM.Event.ARTIFACT_OPENED, getArtifactData);

// the method for onSelect.
function onSelection(artifactArray) {
    $('#errorMessage').remove();
    if (artifactArray.length > 1) {
        $("#artifactUpdateWidget").empty();
        $("#artifactUpdateWidget").append(self.errorMessage("Please selected only one artifact that has a table."));
        return;
    }
    ref = _.clone(artifactArray[0]);
    RM.Data.getAttributes(
        ref, [RM.Data.Attributes.PRIMARY_TEXT, RM.Data.Attributes.IDENTIFIER],
        function (results) {
            if (results.code !== RM.OperationResult.OPERATION_OK) {
                originalHtml = null;
                ref = {};
                $("#artifactUpdateWidget").empty();
                $("#artifactUpdateWidget").append(initialMessage);
                return;
            }
            var tempHtml = results.data[0].values[RM.Data.Attributes.PRIMARY_TEXT];
            var tempwrapper = document.createElement("div");
            tempwrapper.innerHTML = tempHtml;
            var table = $(tempwrapper).find("table");
            if (table.length === 0) {
                $("#artifactUpdateWidget").append(self.errorMessage("Artifact Selected does not have a table."));
                return;
            }
            $("#artifactUpdateWidget").empty();
            $("#artifactUpdateWidget").append(widgetDisplayButtons);
            // widgetDisplayButtons has a button with id of accept, add a onclick method to the button.
            $("#accept").click(function () {
                $("#artifactUpdateWidget").append(self.loadingHTML("Executing"));
                self.onAccept(results);
            });
            // add onclick for cancel button.
            $("#cancel").click(function () {
                if (originalHtml != null) self.onCancel(results);
            });
        }
    );
}

function onAccept(originalArtifactAttributes) {
    // 'parse' the table.
    var toSave = [];
    console.dir(allArtifacts);
    var artifactId = originalArtifactAttributes.data[0].values[RM.Data.Attributes.IDENTIFIER];
    var htmlString = originalArtifactAttributes.data[0].values[RM.Data.Attributes.PRIMARY_TEXT];
    originalHtml = htmlString;
    // create a div to make this string into a DOM object.
    var wrapper = document.createElement("div");
    wrapper.innerHTML = htmlString;
    //using jquery, select what we need. assuming this table will always have three col...
    var firstCol = $(wrapper).find("table > tbody> tr > td:first-child");
    var firstColAtags = $(firstCol).find("a");
    var secondCol = $(wrapper).find("table > tbody> tr > td:nth-child(2)");
    var thirdCol = $(wrapper).find("table > tbody> tr > td:nth-child(3)"); //arrays
    //before we begin, empty out second and third col.
    secondCol.empty();
    thirdCol.empty();
    // variable to keep track of number of times we loop, this way we know we have reached the end of our loop
    var iterations = firstColAtags.length;
    // we will loop through the a tags and using the href link of those a tags, we will get their linked parent artifacts.
    // so, we keep track of the number of a tags and how many parent total those a tags have. thus giving us the number of times we will loop.
    var numberOfATags = iterations;
    var numberOfLinksToATag = 0;
    // loop thru the array of a tags we found, we could use a for loop, but with foreach we don't loose our scope variables.
    // we cant use firstColAtags.forEach because firstColAtags is a HTML Collection, aka not an array. so use lodash to help us out.
    _.forEach(firstColAtags, function (firstColAtag, index) {
        var link = $(firstColAtag).attr("href");
        // set our L4 requirments
        ref.uri = link; // set the reference to the uri we currently have.
        // TODO: What happens if they link an artifact from a different project area ? Look into.
        RM.Data.getLinkedArtifacts(ref, [RM.Data.LinkTypes.PARENT_OF], function (result) {
            if (result.code !== RM.OperationResult.OPERATION_OK) {
                console.dir(result);
                $("#artifactUpdateWidget").append(self.errorMessage("There was an error getting linked artifacts from L3 Requirements"));
                return;
            }
            var artLinks = result.data.artifactLinks;
            if (artLinks.length != 0) {
                // we actually have link types, let's go thru them.
                numberOfLinksToATag += artLinks[0].targets.length;
                for (var m = 0; m < artLinks[0].targets.length; m++) {
                    var parentArtifactRef = artLinks[0].targets[m];
                    // now get the attributes we want for the parent links of the link we are currently in.
                    // NOTE: get attributes first param can take array, so this for loop with m might not be necessary. however the responses/callback might not contain a single value
                    // so we either iterate thru here or inside the callback...
                    RM.Data.getAttributes(parentArtifactRef, [RM.Data.Attributes.NAME, RM.Data.Attributes.IDENTIFIER], function (response) {
                        if (response.code !== RM.OperationResult.OPERATION_OK) {
                            console.dir(response);
                            $("#artifactUpdateWidget").append(self.errorMessage("There was an error getting attributes from the linked artifacts."));
                            return;
                        }
                        var currentThirdCol = $(firstColAtag).closest("tr").find("td:nth-child(3)"); // the place we want to append the string to.
                        var currentSecondCol = $(firstColAtag).closest("tr").find("td:nth-child(2)");
                        var data = response.data[0];
                        var parentArtName = data.values[RM.Data.Attributes.NAME];
                        var parentArtifactUri = data.ref.uri;
                        var parentArtId = data.values[RM.Data.Attributes.IDENTIFIER];
                        var uniqueParentId = "_" + parentArtId + "_thirdCol";

                        for (var p = 0; p < artifactsWithHeaders.length; p++) {
                            for (var b = 0; b < artifactsWithHeaders[p].aTags.length; b++) {
                                var href = artifactsWithHeaders[p].aTags[b];
                                var headerName = artifactsWithHeaders[p].headerInfo.values[RM.Data.Attributes.NAME];
                                var headerId = artifactsWithHeaders[p].headerInfo.values[RM.Data.Attributes.IDENTIFIER];
                                var uniqueHeaderId = "_" + headerId + "_header";
                                if (href === parentArtifactUri && !$(currentThirdCol[0]).find('#' + uniqueParentId).length) {
                                    // does the a tag match the parent artifact uri ? and is it not already present...
                                    var parentTitle = parentArtId + ": " + parentArtName;
                                    var htmlString = "<a  id= " + uniqueParentId + " href='" + parentArtifactUri + "'>" + parentTitle + "</a><br/>";
                                    currentThirdCol.append(htmlString);
                                }
                                if (href === parentArtifactUri && !$(currentSecondCol[0]).find('#' + uniqueHeaderId).length) {
                                    var headerName = artifactsWithHeaders[p].headerInfo.values[RM.Data.Attributes.NAME];
                                    var headerUri = artifactsWithHeaders[p].headerInfo.values[RM.Data.Attributes.NAME];
                                    var sectionNum = artifactsWithHeaders[p].headerInfo.values[RM.Data.Attributes.SECTION_NUMBER];
                                    var title = sectionNum + ": " + headerName;
                                    var headerHtmlString = "<a id=" + uniqueHeaderId + " href='" + artifactsWithHeaders[p].headerInfo.ref.uri + "'>" + title + "</a><br/>";
                                    currentSecondCol.append(headerHtmlString);
                                }
                            }
                        }
                        if (allArtifacts[parentArtId] && !$(currentThirdCol[0]).find('#' + uniqueParentId).length) {
                            // the parent exists in this module and does it not already exists ?
                            var title = parentArtId + ": " + parentArtName;
                            var htmlString = "<a id= " + uniqueParentId + " href='" + parentArtifactUri + "'>" + title + "</a><br/>";
                            currentThirdCol.append(htmlString);
                        }
                        iterations++;
                        if (numberOfATags + numberOfLinksToATag === iterations) {
                            console.log("Time to save the artifact.");
                            self.saveArtifact(wrapper, originalArtifactAttributes);
                        }
                    });
                }
            }
        });
    })
}

// method to save an artifact.
function saveArtifact(wrapper, opResult) {
    var newXmlString = wrapper.innerHTML;
    var toSave = [];
    opResult.data.forEach(function (item) {
        item.values[RM.Data.Attributes.PRIMARY_TEXT] = newXmlString;
        toSave.push(item);
    });
    RM.Data.setAttributes(toSave, function (res) {
        if (res.code !== RM.OperationResult.OPERATION_OK) {
            console.dir(res);
            $("#artifactUpdateWidget").append(self.errorMessage("There was an error saving the artifact..."));
            return;
        }
        $("#loadingIcon").remove();
    });
}

function onCancel(opResult) {
    $("#artifactUpdateWidget").append(self.loadingHTML("Reverting"));
    var toSave = [];
    opResult.data.forEach(function (item) {
        item.values[RM.Data.Attributes.PRIMARY_TEXT] = originalHtml;
        toSave.push(item);
    });

    RM.Data.setAttributes(toSave, function (res) {
        if (res.code !== RM.OperationResult.OPERATION_OK) {
            console.dir(res);
            $("#artifactUpdateWidget").append(self.errorMessage("There was an error reverting the artifact..."));
        }
        $("#loadingIcon").remove();
    });
}

// when artifact is opened, get all the artifacts and get the relevant data we need.
// add it to our data structure.
function getArtifactData(ref) {
    RM.Data.getContentsAttributes(
        ref, [RM.Data.Attributes.PRIMARY_TEXT, RM.Data.Attributes.IDENTIFIER, RM.Data.Attributes.IS_HEADING, RM.Data.Attributes.NAME, RM.Data.Attributes.SECTION_NUMBER],
        function (opResult) {
            if (opResult.code === RM.OperationResult.OPERATION_OK) {
                var currentHeader = null;
                allArtifacts = {};
                for (var i = 0; i < opResult.data.length; i++) {
                    var artf = opResult.data[i];
                    
                    // only add an attribute if it doesn't have a table.
                    var tempHtml = artf.values[RM.Data.Attributes.PRIMARY_TEXT];
                    var tempwrapper = document.createElement("div");
                    tempwrapper.innerHTML = tempHtml;
                    var table = $(tempwrapper).find("table");
                    if (table.length === 0) {
                        allArtifacts[artf.values[RM.Data.Attributes.IDENTIFIER]] = artf;
                    }

                }
                // simply has an array of ALL the artifacts from this module.
                self.artifactsWithHeaders = allArtifacts.map(function (aa) {
                    currentHeader = aa.values[RM.Data.Attributes.IS_HEADING] ? aa : currentHeader;
                    return ({
                        id: aa.values[RM.Data.Attributes.IDENTIFIER],
                        aTags: self.getATags(
                            aa.values[RM.Data.Attributes.PRIMARY_TEXT]
                        ),
                        isHeading: aa.values[RM.Data.Attributes.IS_HEADING] == true,
                        headerInfo: _.isEqual(aa, currentHeader) ? null : currentHeader,
                        uri: ref.uri
                    })
                }).filter(function (obj) {
                    // if the artifact does not have a header under it or if it is a header, we don't care.
                    return obj.headerInfo !== null;
                }).filter(function (obj) {
                    // if the artifact does not have a single a tag, we don't care.
                    return obj.aTags.length !== 0;
                });
            }
        }
    );
}

// returns an array of urls found from <a> tags from a dom string.
// TODO: Update with jQuery or who cares ? 
function getATags(domString) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = domString;
    var arrLinks = [];
    var links = wrapper.getElementsByTagName("a");
    for (var i = 0; i < links.length; i++) {
        arrLinks.push(links[i].href);
    }
    return arrLinks;
}

// function to display the html for a loading icon with the text you want.
function loadingHTML(text) {
    return (
        "<div class='actionContainer' id='loadingIcon'><div class='loader'></div>" +
        text +
        "...</div>"
    );
}

function errorMessage(text) {
    $("#loadingIcon").remove();
    return (
        "<div class='actionContainer' id='errorMessage' style='color:red'>Error!: " +
        text +
        "</div>"
    );
}