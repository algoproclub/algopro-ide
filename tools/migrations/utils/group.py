from google.cloud.firestore import DocumentReference, Client

def change_group_ids(fs_client: Client, old_group_id_to_new_group_id: dict[str, str]) -> None:
    user_to_group_changes = {}
    for doc in fs_client.collection("userdata").list_documents():
        doc: DocumentReference = doc
        snap = doc.get()
        old_groups = snap.get("groups")
        if len(old_groups) == 0:
            continue

        new_groups = [old_group_id_to_new_group_id[og] for og in old_groups]
        user_to_group_changes[doc.id] = {
            "old": old_groups,
            "new": new_groups,
        }

    print("The following changes will be made to the firstore:")
    for id, change in user_to_group_changes.items():
        print(f"- Update groups of user {id}")
        print(f"    from: {change['old']}")
        print(f"    to: {change['new']}")
    print()

    for old_id, new_id in old_group_id_to_new_group_id.items():
        print(f"- Move group and related classes from under '{old_id}' to '{new_id}'")

    print()
    print("Execute changes? To proceed, type 'Yes'")
    if input("") != "Yes":
        print("Cancelled rename operation")
        return

    for id, change in user_to_group_changes.items():
        new_groups = change["new"]
        doc = fs_client.document("userdata", id)
        doc.update({"groups": new_groups})
        print(f"Updated groups of {id}")

    def move_doc(old_doc: DocumentReference, new_doc: DocumentReference):
        data = old_doc.get().to_dict()
        assert data is not None
        new_doc.create(data)
        old_doc.delete()

    for old_id, new_id in old_group_id_to_new_group_id.items():
        # move group
        old_doc = fs_client.document("groups", old_id)
        new_doc = fs_client.document("groups", new_id)
        move_doc(old_doc, new_doc)

        # also move classes
        for old_coll_doc in fs_client.collection("groups", old_id, "classes").list_documents():
            old_coll_doc: DocumentReference = old_coll_doc
            new_coll_doc = fs_client.document("groups", new_id, "classes", old_coll_doc.id)
            move_doc(old_coll_doc, new_coll_doc)

